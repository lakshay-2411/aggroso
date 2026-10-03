"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeAssessment } from "@/lib/assessments/analyze";
import {
  computeStaleness,
  loadStalenessContext,
  snapshotRevisions,
} from "@/lib/assessments/staleness";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

const schema = z.object({
  assessmentId: z.uuid(),
  fromVersionId: z.uuid(),
});

/**
 * Re-evaluates a stale assessment by creating a new assessment version that
 * supersedes it, running the analysis against the current policy version and
 * control register, and carrying forward reviewer decisions, remediation
 * actions, and risk acceptances for items that were not affected by the
 * change. Everything carried forward is audited.
 */
export async function reevaluateAssessment(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    assessmentId: formData.get("assessmentId"),
    fromVersionId: formData.get("fromVersionId"),
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const actor = { id: user.id, email: user.email ?? null };

  const { data: previous, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", parsed.data.assessmentId)
    .maybeSingle();
  if (error || !previous) throw new Error("Assessment not found.");
  if (previous.superseded_by_id) throw new Error("This assessment was already re-evaluated.");
  if (previous.status !== "in_review" && previous.status !== "completed") {
    throw new Error("Only analysed assessments can be re-evaluated.");
  }

  const context = await loadStalenessContext();
  const reasons = computeStaleness(previous, context);
  const latest = context.latestVersions.get(previous.policy_id);
  if (!latest) throw new Error("Policy versions could not be loaded.");

  const fromNumber = context.versionNumbers.get(parsed.data.fromVersionId);
  if (fromNumber === undefined || fromNumber >= latest.version_number) {
    throw new Error("The starting version must be older than the latest policy version.");
  }

  const policyChanged = latest.id !== previous.to_version_id;
  const changedControlIds = new Set(
    reasons
      .filter((r) => r.type === "control_changed" || r.type === "control_deactivated")
      .map((r) => (r as { control_id: string }).control_id),
  );

  // Create the new version.
  const { count } = await supabase
    .from("assessments")
    .select("id", { count: "exact", head: true })
    .eq("policy_id", previous.policy_id)
    .eq("from_version_id", parsed.data.fromVersionId)
    .eq("to_version_id", latest.id);

  const { data: created, error: createError } = await supabase
    .from("assessments")
    .insert({
      policy_id: previous.policy_id,
      from_version_id: parsed.data.fromVersionId,
      to_version_id: latest.id,
      assessment_version: Math.max(previous.assessment_version + 1, (count ?? 0) + 1),
      supersedes_id: previous.id,
      created_by: user.id,
    })
    .select("id, assessment_version")
    .single();
  if (createError || !created) {
    throw new Error(`Could not create re-evaluation: ${createError?.message ?? "unknown"}`);
  }
  const newId = created.id;

  // Carry answered context over so the model benefits from it.
  const { data: answered } = await supabase
    .from("context_questions")
    .select("question, why_needed, related_control_ids, answer, answered_by, answered_at")
    .eq("assessment_id", previous.id)
    .not("answer", "is", null);
  if (answered && answered.length > 0) {
    await supabase.from("context_questions").insert(
      answered.map((q) => ({ ...q, assessment_id: newId })),
    );
  }

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    entityType: "assessment",
    entityId: newId,
    action: "reevaluation_started",
    details: {
      supersedes_id: previous.id,
      previous_version: previous.assessment_version,
      policy_changed: policyChanged,
      changed_control_ids: [...changedControlIds],
      stale_reasons: reasons as never,
    },
  });

  await analyzeAssessment(supabase, actor, newId);

  const { data: fresh } = await supabase
    .from("assessments")
    .select("status, ai_error")
    .eq("id", newId)
    .single();
  if (!fresh || fresh.status !== "in_review") {
    // Analysis failed; leave the old assessment current so nothing is lost.
    revalidatePath("/assessments");
    redirect(`/assessments/${newId}`);
  }

  // Carry forward decisions for unaffected mappings.
  const [{ data: oldChanges }, { data: newChanges }, { data: oldMappings }, { data: newMappings }] =
    await Promise.all([
      supabase.from("requirement_changes").select("*").eq("assessment_id", previous.id),
      supabase.from("requirement_changes").select("*").eq("assessment_id", newId),
      supabase.from("impact_mappings").select("*").eq("assessment_id", previous.id),
      supabase.from("impact_mappings").select("*").eq("assessment_id", newId),
    ]);

  const oldChangeById = new Map((oldChanges ?? []).map((c) => [c.id, c]));
  const changeKey = (c: { change_type: string; new_section_ref: string | null; new_text: string | null; old_text: string | null }) =>
    `${c.change_type}|${normalize(c.new_section_ref)}|${normalize(c.new_text)}|${normalize(c.old_text)}`;
  const oldByKey = new Map<string, NonNullable<typeof oldMappings>>();
  for (const m of oldMappings ?? []) {
    const change = oldChangeById.get(m.requirement_change_id);
    if (!change) continue;
    const key = `${changeKey(change)}|${m.control_id}`;
    const list = oldByKey.get(key) ?? [];
    list.push(m);
    oldByKey.set(key, list);
  }
  const newChangeById = new Map((newChanges ?? []).map((c) => [c.id, c]));
  const previousSnapshot = snapshotRevisions(previous.control_snapshot);

  let carried = 0;
  let movedActions = 0;
  let movedAcceptances = 0;
  for (const m of newMappings ?? []) {
    const change = newChangeById.get(m.requirement_change_id);
    if (!change) continue;
    if (changedControlIds.has(m.control_id)) continue; // control changed: needs fresh review
    if (!(m.control_id in previousSnapshot)) continue; // new control: never reviewed
    const prior = oldByKey.get(`${changeKey(change)}|${m.control_id}`)?.[0];
    if (!prior || prior.review_status === "pending") continue;

    const { error: updateError } = await supabase
      .from("impact_mappings")
      .update({
        review_status: prior.review_status,
        final_impact_level: prior.final_impact_level,
        reviewer_id: prior.reviewer_id,
        reviewed_at: prior.reviewed_at,
        reviewer_note: `${prior.reviewer_note ? `${prior.reviewer_note} ` : ""}(carried forward from assessment v${previous.assessment_version})`,
        no_action_required: prior.no_action_required,
      })
      .eq("id", m.id);
    if (updateError) continue;
    carried += 1;

    const { data: moved } = await supabase.rpc("move_mapping_dependents", {
      p_from_mapping: prior.id,
      p_to_mapping: m.id,
      p_to_assessment: newId,
    });
    if (moved && typeof moved === "object" && !Array.isArray(moved)) {
      movedActions += Number((moved as Record<string, unknown>).actions ?? 0);
      movedAcceptances += Number((moved as Record<string, unknown>).acceptances ?? 0);
    }

    await recordAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "impact_mapping",
      entityId: m.id,
      action: "carried_forward",
      details: {
        from_mapping_id: prior.id,
        from_assessment_id: previous.id,
        review_status: prior.review_status,
        final_impact_level: prior.final_impact_level,
      },
    });
  }

  await supabase
    .from("assessments")
    .update({ superseded_by_id: newId })
    .eq("id", previous.id);

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    entityType: "assessment",
    entityId: previous.id,
    action: "superseded",
    details: { superseded_by_id: newId, new_version: created.assessment_version },
  });
  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    entityType: "assessment",
    entityId: newId,
    action: "reevaluation_completed",
    details: {
      carried_forward_mappings: carried,
      moved_actions: movedActions,
      moved_risk_acceptances: movedAcceptances,
    },
  });

  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  revalidatePath("/actions");
  revalidatePath(`/assessments/${previous.id}`, "page");
  redirect(`/assessments/${newId}`);
}
