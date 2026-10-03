import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAssessmentPipeline, type PipelineControl } from "@/lib/ai/pipeline";
import { recordAudit } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";

export interface Actor {
  id: string;
  email: string | null;
}

/**
 * Runs the AI pipeline for an assessment and stores the results. Shared by
 * the "run analysis" action and by re-evaluation. Callers are responsible
 * for status guards; this function sets analyzing -> in_review | failed.
 */
export async function analyzeAssessment(
  supabase: SupabaseClient<Database>,
  user: Actor,
  assessmentId: string,
): Promise<void> {
  const { data: assessment, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error || !assessment) throw new Error("Assessment not found.");

  const [policyRes, versionsRes, controlsRes, evidenceRes, profilesRes, questionsRes] =
    await Promise.all([
      supabase.from("policies").select("title").eq("id", assessment.policy_id).single(),
      supabase
        .from("policy_versions")
        .select("id, label, content, effective_date")
        .in("id", [assessment.from_version_id, assessment.to_version_id]),
      supabase.from("controls").select("*").eq("is_active", true).order("control_ref"),
      supabase.from("control_evidence").select("control_id, title, description, evidence_date"),
      supabase.from("profiles").select("id, email, full_name"),
      supabase
        .from("context_questions")
        .select("question, answer")
        .eq("assessment_id", assessmentId)
        .not("answer", "is", null),
    ]);

  const oldVersion = versionsRes.data?.find((v) => v.id === assessment.from_version_id);
  const newVersion = versionsRes.data?.find((v) => v.id === assessment.to_version_id);
  if (!policyRes.data || !oldVersion || !newVersion) {
    throw new Error("Policy versions could not be loaded.");
  }

  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const evidenceByControl = new Map<string, PipelineControl["evidence"]>();
  for (const e of evidenceRes.data ?? []) {
    const list = evidenceByControl.get(e.control_id) ?? [];
    list.push({ title: e.title, date: e.evidence_date, description: e.description });
    evidenceByControl.set(e.control_id, list);
  }

  const controls: PipelineControl[] = (controlsRes.data ?? []).map((c) => {
    const owner = c.owner_id ? profiles.get(c.owner_id) : null;
    return {
      id: c.id,
      control_ref: c.control_ref,
      title: c.title,
      description: c.description,
      category: c.category,
      owner: owner ? (owner.full_name ?? owner.email) : (c.owner_name ?? "Unassigned"),
      remediation_status: c.remediation_status,
      remediation_notes: c.remediation_notes,
      evidence: evidenceByControl.get(c.id) ?? [],
    };
  });

  const controlSnapshot: Record<string, number> = {};
  for (const c of controlsRes.data ?? []) controlSnapshot[c.id] = c.revision;

  await supabase
    .from("assessments")
    .update({ status: "analyzing", ai_error: null })
    .eq("id", assessmentId);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "assessment",
    entityId: assessmentId,
    action: "analysis_started",
    details: { control_count: controls.length },
  });

  try {
    const result = await runAssessmentPipeline({
      policyTitle: policyRes.data.title,
      oldVersion: { label: oldVersion.label, content: oldVersion.content },
      newVersion: {
        label: newVersion.label,
        content: newVersion.content,
        effectiveDate: newVersion.effective_date,
      },
      controls,
      answeredQuestions: (questionsRes.data ?? [])
        .filter((q): q is { question: string; answer: string } => Boolean(q.answer))
        .map((q) => ({ question: q.question, answer: q.answer })),
    });

    // Replace prior unreviewed results. Answered questions are kept.
    await supabase.from("impact_mappings").delete().eq("assessment_id", assessmentId);
    await supabase.from("requirement_changes").delete().eq("assessment_id", assessmentId);
    await supabase
      .from("context_questions")
      .delete()
      .eq("assessment_id", assessmentId)
      .is("answer", null);

    const changeIds = new Map<number, string>();
    if (result.changes.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("requirement_changes")
        .insert(
          result.changes.map((c) => ({
            assessment_id: assessmentId,
            position: c.position,
            change_type: c.change_type,
            title: c.title,
            summary: c.summary,
            old_section_ref: c.old_section_ref,
            old_text: c.old_text,
            new_section_ref: c.new_section_ref,
            new_text: c.new_text,
            rationale: c.rationale,
            citation_verified: c.citation_verified,
          })),
        )
        .select("id, position");
      if (insertError) throw new Error(`Saving changes failed: ${insertError.message}`);
      for (const row of inserted ?? []) changeIds.set(row.position, row.id);
    }

    if (result.mappings.length > 0) {
      const { error: mappingError } = await supabase.from("impact_mappings").insert(
        result.mappings
          .filter((m) => changeIds.has(m.change_position))
          .map((m) => ({
            assessment_id: assessmentId,
            requirement_change_id: changeIds.get(m.change_position) as string,
            control_id: m.control_id,
            ai_impact_level: m.ai_impact_level,
            ai_rationale: m.ai_rationale,
            evidence_outdated: m.evidence_outdated,
            evidence_rationale: m.evidence_rationale,
            suggested_remediation: m.suggested_remediation,
          })),
      );
      if (mappingError) throw new Error(`Saving mappings failed: ${mappingError.message}`);
    }

    if (result.questions.length > 0) {
      const { error: questionError } = await supabase.from("context_questions").insert(
        result.questions.map((q) => ({
          assessment_id: assessmentId,
          question: q.question,
          why_needed: q.why_needed,
          related_control_ids: q.related_control_ids,
        })),
      );
      if (questionError) throw new Error(`Saving questions failed: ${questionError.message}`);
    }

    await supabase
      .from("assessments")
      .update({
        status: "in_review",
        ai_model: result.model,
        ai_summary: result.summary,
        ai_error: null,
        control_snapshot: controlSnapshot,
        is_stale: false,
        stale_reasons: [],
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      entityType: "assessment",
      entityId: assessmentId,
      action: "analysis_completed",
      details: {
        model: result.model,
        diff_hunks: result.hunkCount,
        model_calls: result.calls,
        changes: result.changes.length,
        mappings: result.mappings.length,
        questions: result.questions.length,
        dropped_mappings: result.droppedMappings,
        unverified_citations: result.changes.filter((c) => !c.citation_verified).length,
        tokens: result.usage.totalTokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("assessments")
      .update({ status: "failed", ai_error: message })
      .eq("id", assessmentId);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      entityType: "assessment",
      entityId: assessmentId,
      action: "analysis_failed",
      details: { error: message },
    });
  }

}
