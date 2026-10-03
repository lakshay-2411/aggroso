"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { analyzeAssessment } from "@/lib/assessments/analyze";
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

const createSchema = z
  .object({
    policyId: z.uuid(),
    fromVersionId: z.uuid(),
    toVersionId: z.uuid(),
  })
  .refine((v) => v.fromVersionId !== v.toVersionId, {
    message: "Choose two different versions.",
  });

/** Creates a draft assessment for a policy version pair. */
export async function createAssessment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse({
    policyId: formData.get("policyId"),
    fromVersionId: formData.get("fromVersionId"),
    toVersionId: formData.get("toVersionId"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: versions, error: versionsError } = await supabase
    .from("policy_versions")
    .select("id, policy_id, version_number")
    .in("id", [input.fromVersionId, input.toVersionId]);
  if (versionsError) return { error: versionsError.message };
  const from = versions?.find((v) => v.id === input.fromVersionId);
  const to = versions?.find((v) => v.id === input.toVersionId);
  if (!from || !to || from.policy_id !== input.policyId || to.policy_id !== input.policyId) {
    return { error: "Both versions must belong to the selected policy." };
  }
  if (from.version_number >= to.version_number) {
    return { error: "The previous version must be older than the new version." };
  }

  // Assessment version counts prior runs for the same policy pair.
  const { count } = await supabase
    .from("assessments")
    .select("id", { count: "exact", head: true })
    .eq("policy_id", input.policyId)
    .eq("from_version_id", input.fromVersionId)
    .eq("to_version_id", input.toVersionId);

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      policy_id: input.policyId,
      from_version_id: input.fromVersionId,
      to_version_id: input.toVersionId,
      assessment_version: (count ?? 0) + 1,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: `Could not create assessment: ${error?.message}` };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "assessment",
    entityId: data.id,
    action: "created",
    details: {
      policy_id: input.policyId,
      from_version_id: input.fromVersionId,
      to_version_id: input.toVersionId,
      assessment_version: (count ?? 0) + 1,
    },
  });

  revalidatePath("/assessments");
  redirect(`/assessments/${data.id}`);
}

/**
 * Runs the AI pipeline for a draft or failed assessment and stores results.
 * Replaces any previous unreviewed results on the same assessment.
 */
export async function runAnalysis(formData: FormData): Promise<void> {
  const parsed = z.object({ assessmentId: z.uuid() }).safeParse({
    assessmentId: formData.get("assessmentId"),
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const assessmentId = parsed.data.assessmentId;

  const { supabase, user } = await requireUser();

  const { data: assessment, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error || !assessment) throw new Error("Assessment not found.");
  if (assessment.status === "analyzing") {
    throw new Error("Analysis is already running.");
  }
  if (assessment.status === "completed") {
    throw new Error("A completed assessment cannot be re-analysed. Start a new assessment version.");
  }
  if (assessment.status === "in_review") {
    // Re-running is only safe while nothing has been reviewed yet; otherwise
    // reviewer decisions would be lost. Later versions handle re-evaluation.
    const { count } = await supabase
      .from("impact_mappings")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId)
      .neq("review_status", "pending");
    if ((count ?? 0) > 0) {
      throw new Error(
        "Mappings have already been reviewed. Start a new assessment version instead of re-running.",
      );
    }
  }

  await analyzeAssessment(supabase, { id: user.id, email: user.email ?? null }, assessmentId);

  revalidatePath("/assessments");
  revalidatePath(`/assessments/${assessmentId}`, "page");
}

const answerSchema = z.object({
  questionId: z.uuid(),
  assessmentId: z.uuid(),
  answer: z.string().trim().min(1, "Enter an answer.").max(4000),
});

/** Records a reviewer's answer to a missing-context question. */
export async function answerQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = answerSchema.safeParse({
    questionId: formData.get("questionId"),
    assessmentId: formData.get("assessmentId"),
    answer: formData.get("answer"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("context_questions")
    .update({
      answer: parsed.data.answer,
      answered_by: user.id,
      answered_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.questionId)
    .eq("assessment_id", parsed.data.assessmentId);
  if (error) return { error: `Could not save answer: ${error.message}` };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "context_question",
    entityId: parsed.data.questionId,
    action: "answered",
    details: { assessment_id: parsed.data.assessmentId, answer: parsed.data.answer },
  });

  revalidatePath(`/assessments/${parsed.data.assessmentId}`, "page");
  return { error: null, success: "Answer saved. Re-run analysis to use it." };
}
