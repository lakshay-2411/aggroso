"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return { supabase, user };
}

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v.length === 0 ? null : v));

const reviewSchema = z
  .object({
    mappingId: z.uuid(),
    assessmentId: z.uuid(),
    decision: z.enum(["accept", "reject", "correct", "reset"]),
    correctedLevel: z.enum(["confirmed", "possible"]).nullable(),
    noActionRequired: z.boolean(),
    note: optionalText,
  })
  .refine((v) => v.decision !== "correct" || v.correctedLevel !== null, {
    message: "Choose the corrected impact level.",
  })
  .refine((v) => v.decision !== "reject" || v.note !== null, {
    message: "Give a reason when rejecting a mapping.",
  });

/** Records a reviewer decision on an impact mapping. Decisions can be changed. */
export async function reviewMapping(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = reviewSchema.safeParse({
    mappingId: formData.get("mappingId"),
    assessmentId: formData.get("assessmentId"),
    decision: formData.get("decision"),
    correctedLevel: formData.get("correctedLevel") || null,
    noActionRequired: formData.get("noActionRequired") === "on",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const [{ data: mapping }, { data: assessment }] = await Promise.all([
    supabase
      .from("impact_mappings")
      .select("*")
      .eq("id", input.mappingId)
      .eq("assessment_id", input.assessmentId)
      .maybeSingle(),
    supabase.from("assessments").select("status").eq("id", input.assessmentId).maybeSingle(),
  ]);
  if (!mapping) return { error: "Mapping not found." };
  if (!assessment || assessment.status !== "in_review") {
    return { error: "Mappings can only be reviewed while the assessment is in review." };
  }

  const now = new Date().toISOString();
  const update =
    input.decision === "reset"
      ? {
          review_status: "pending" as const,
          final_impact_level: null,
          reviewer_id: null,
          reviewed_at: null,
          reviewer_note: null,
          no_action_required: false,
        }
      : {
          review_status:
            input.decision === "accept"
              ? ("accepted" as const)
              : input.decision === "reject"
                ? ("rejected" as const)
                : ("corrected" as const),
          final_impact_level:
            input.decision === "accept"
              ? mapping.ai_impact_level
              : input.decision === "correct"
                ? input.correctedLevel
                : null,
          reviewer_id: user.id,
          reviewed_at: now,
          reviewer_note: input.note,
          no_action_required: input.decision === "reject" ? false : input.noActionRequired,
        };

  const { error } = await supabase
    .from("impact_mappings")
    .update(update)
    .eq("id", input.mappingId);
  if (error) return { error: `Could not save decision: ${error.message}` };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "impact_mapping",
    entityId: input.mappingId,
    action: `review_${input.decision}`,
    details: {
      assessment_id: input.assessmentId,
      control_id: mapping.control_id,
      requirement_change_id: mapping.requirement_change_id,
      before: {
        review_status: mapping.review_status,
        final_impact_level: mapping.final_impact_level,
        no_action_required: mapping.no_action_required,
        reviewer_note: mapping.reviewer_note,
      },
      after: {
        review_status: update.review_status,
        final_impact_level: update.final_impact_level,
        no_action_required: update.no_action_required,
        reviewer_note: update.reviewer_note,
      },
      ai_impact_level: mapping.ai_impact_level,
    },
  });

  revalidatePath(`/assessments/${input.assessmentId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  return { error: null, success: "Decision saved." };
}

const addMappingSchema = z.object({
  assessmentId: z.uuid(),
  changeId: z.uuid(),
  controlId: z.uuid(),
  level: z.enum(["confirmed", "possible"]),
  rationale: z.string().trim().min(1, "Explain why this control is affected.").max(2000),
  evidenceOutdated: z.boolean(),
  suggestedRemediation: optionalText,
});

/** Lets a reviewer add a mapping the agent missed. Counts as accepted. */
export async function addManualMapping(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addMappingSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    changeId: formData.get("changeId"),
    controlId: formData.get("controlId"),
    level: formData.get("level"),
    rationale: formData.get("rationale"),
    evidenceOutdated: formData.get("evidenceOutdated") === "on",
    suggestedRemediation: formData.get("suggestedRemediation") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: assessment } = await supabase
    .from("assessments")
    .select("status")
    .eq("id", input.assessmentId)
    .maybeSingle();
  if (!assessment || assessment.status !== "in_review") {
    return { error: "Mappings can only be added while the assessment is in review." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("impact_mappings")
    .insert({
      assessment_id: input.assessmentId,
      requirement_change_id: input.changeId,
      control_id: input.controlId,
      ai_impact_level: input.level,
      ai_rationale: input.rationale,
      evidence_outdated: input.evidenceOutdated,
      evidence_rationale: null,
      suggested_remediation: input.suggestedRemediation,
      review_status: "accepted",
      final_impact_level: input.level,
      reviewer_id: user.id,
      reviewed_at: now,
      reviewer_note: "Added manually by reviewer.",
      source: "reviewer",
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "That control is already mapped to this change."
          : `Could not add mapping: ${error?.message ?? "unknown"}`,
    };
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "impact_mapping",
    entityId: data.id,
    action: "added_by_reviewer",
    details: {
      assessment_id: input.assessmentId,
      control_id: input.controlId,
      requirement_change_id: input.changeId,
      impact_level: input.level,
      rationale: input.rationale,
    },
  });

  revalidatePath(`/assessments/${input.assessmentId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  return { error: null, success: "Mapping added." };
}

/** Marks an assessment as completed once every mapping has a decision. */
export async function completeAssessment(formData: FormData): Promise<void> {
  const parsed = z.object({ assessmentId: z.uuid() }).safeParse({
    assessmentId: formData.get("assessmentId"),
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const assessmentId = parsed.data.assessmentId;

  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("impact_mappings")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .eq("review_status", "pending");
  if ((count ?? 0) > 0) {
    throw new Error("All mappings must be reviewed before completing the assessment.");
  }

  const { error } = await supabase
    .from("assessments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", assessmentId)
    .eq("status", "in_review");
  if (error) throw new Error(`Could not complete assessment: ${error.message}`);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "assessment",
    entityId: assessmentId,
    action: "completed",
  });

  revalidatePath(`/assessments/${assessmentId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
}

/** Returns a completed assessment to review, for example after new findings. */
export async function reopenAssessment(formData: FormData): Promise<void> {
  const parsed = z.object({ assessmentId: z.uuid() }).safeParse({
    assessmentId: formData.get("assessmentId"),
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const assessmentId = parsed.data.assessmentId;

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("assessments")
    .update({ status: "in_review", completed_at: null })
    .eq("id", assessmentId)
    .eq("status", "completed");
  if (error) throw new Error(`Could not reopen assessment: ${error.message}`);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "assessment",
    entityId: assessmentId,
    action: "reopened",
  });

  revalidatePath(`/assessments/${assessmentId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
}
