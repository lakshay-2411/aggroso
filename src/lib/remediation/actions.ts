"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { ACTION_STATUSES } from "@/lib/remediation/constants";
import { createClient } from "@/lib/supabase/server";
import type { ActionStatus } from "@/lib/supabase/database.types";

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
  .transform((v) => (v.length === 0 ? null : v));
const optionalUuid = optionalText.pipe(z.uuid().nullable());
const optionalDate = optionalText.pipe(z.iso.date("Enter a valid date.").nullable());

function revalidateAll(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/actions");
  revalidatePath("/dashboard");
}

const createActionSchema = z.object({
  assessmentId: z.uuid(),
  mappingId: z.uuid(),
  title: z.string().trim().min(1, "Enter a title for the action.").max(300),
  description: optionalText.pipe(z.string().max(4000).nullable()),
  ownerId: optionalUuid,
  ownerName: optionalText.pipe(z.string().max(120).nullable()),
  dueDate: optionalDate,
});

/** Creates a remediation action against an accepted impact mapping. */
export async function createRemediationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createActionSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    mappingId: formData.get("mappingId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    ownerId: formData.get("ownerId") ?? "",
    ownerName: formData.get("ownerName") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: mapping } = await supabase
    .from("impact_mappings")
    .select("id, control_id, review_status")
    .eq("id", input.mappingId)
    .eq("assessment_id", input.assessmentId)
    .maybeSingle();
  if (!mapping) return { error: "Mapping not found." };
  if (mapping.review_status !== "accepted" && mapping.review_status !== "corrected") {
    return { error: "Actions can only be created for accepted mappings." };
  }
  if (!input.ownerId && !input.ownerName) {
    return { error: "Assign an owner: pick an app user or type a name." };
  }

  const { data, error } = await supabase
    .from("remediation_actions")
    .insert({
      assessment_id: input.assessmentId,
      impact_mapping_id: input.mappingId,
      control_id: mapping.control_id,
      title: input.title,
      description: input.description,
      owner_id: input.ownerId,
      owner_name: input.ownerName,
      due_date: input.dueDate,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: `Could not create action: ${error?.message ?? "unknown"}` };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "remediation_action",
    entityId: data.id,
    action: "created",
    details: {
      assessment_id: input.assessmentId,
      impact_mapping_id: input.mappingId,
      control_id: mapping.control_id,
      title: input.title,
      owner_id: input.ownerId,
      owner_name: input.ownerName,
      due_date: input.dueDate,
    },
  });

  revalidateAll(input.assessmentId);
  return { error: null, success: "Action created." };
}

const updateActionSchema = z.object({
  actionId: z.uuid(),
  assessmentId: z.uuid(),
  status: z.enum(ACTION_STATUSES as [ActionStatus, ...ActionStatus[]]),
  ownerId: optionalUuid,
  ownerName: optionalText.pipe(z.string().max(120).nullable()),
  dueDate: optionalDate,
});

/** Updates status, owner, or due date of an action. */
export async function updateRemediationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateActionSchema.safeParse({
    actionId: formData.get("actionId"),
    assessmentId: formData.get("assessmentId"),
    status: formData.get("status"),
    ownerId: formData.get("ownerId") ?? "",
    ownerName: formData.get("ownerName") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: before } = await supabase
    .from("remediation_actions")
    .select("*")
    .eq("id", input.actionId)
    .maybeSingle();
  if (!before) return { error: "Action not found." };
  if (!input.ownerId && !input.ownerName) {
    return { error: "An action must keep an owner." };
  }

  const after = {
    status: input.status,
    owner_id: input.ownerId,
    owner_name: input.ownerName,
    due_date: input.dueDate,
    completed_at:
      input.status === "done"
        ? (before.completed_at ?? new Date().toISOString())
        : null,
  };

  const { error } = await supabase
    .from("remediation_actions")
    .update(after)
    .eq("id", input.actionId);
  if (error) return { error: `Could not update action: ${error.message}` };

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of ["status", "owner_id", "owner_name", "due_date"] as const) {
    if (before[key] !== after[key]) changed[key] = { from: before[key], to: after[key] };
  }
  if (Object.keys(changed).length > 0) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      entityType: "remediation_action",
      entityId: input.actionId,
      action: input.status !== before.status ? `status_${input.status}` : "updated",
      details: {
        assessment_id: input.assessmentId,
        impact_mapping_id: before.impact_mapping_id,
        control_id: before.control_id,
        changed: changed as never,
      },
    });
  }

  revalidateAll(input.assessmentId);
  return { error: null, success: "Action updated." };
}

const acceptRiskSchema = z.object({
  assessmentId: z.uuid(),
  mappingId: z.uuid(),
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters.").max(4000),
  reviewDate: z.iso.date("Enter a valid review date."),
});

/** Formally accepts the risk of not remediating an accepted impact. */
export async function acceptRisk(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = acceptRiskSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    mappingId: formData.get("mappingId"),
    reason: formData.get("reason"),
    reviewDate: formData.get("reviewDate"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const today = new Date().toISOString().slice(0, 10);
  if (input.reviewDate <= today) {
    return { error: "The review date must be in the future." };
  }

  const { data: mapping } = await supabase
    .from("impact_mappings")
    .select("id, control_id, review_status")
    .eq("id", input.mappingId)
    .eq("assessment_id", input.assessmentId)
    .maybeSingle();
  if (!mapping) return { error: "Mapping not found." };
  if (mapping.review_status !== "accepted" && mapping.review_status !== "corrected") {
    return { error: "Risk can only be accepted on an accepted mapping." };
  }

  const { data, error } = await supabase
    .from("risk_acceptances")
    .insert({
      assessment_id: input.assessmentId,
      impact_mapping_id: input.mappingId,
      control_id: mapping.control_id,
      reason: input.reason,
      review_date: input.reviewDate,
      accepted_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "This mapping already has an active risk acceptance."
          : `Could not record risk acceptance: ${error?.message ?? "unknown"}`,
    };
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "risk_acceptance",
    entityId: data.id,
    action: "accepted",
    details: {
      assessment_id: input.assessmentId,
      impact_mapping_id: input.mappingId,
      control_id: mapping.control_id,
      reason: input.reason,
      review_date: input.reviewDate,
    },
  });

  revalidateAll(input.assessmentId);
  return { error: null, success: "Risk acceptance recorded." };
}

const revokeSchema = z.object({
  acceptanceId: z.uuid(),
  assessmentId: z.uuid(),
  reason: z.string().trim().min(1, "Give a reason for revoking.").max(2000),
});

/** Revokes an active risk acceptance. The record is kept. */
export async function revokeRiskAcceptance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = revokeSchema.safeParse({
    acceptanceId: formData.get("acceptanceId"),
    assessmentId: formData.get("assessmentId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: existing } = await supabase
    .from("risk_acceptances")
    .select("id, impact_mapping_id, control_id, revoked_at")
    .eq("id", input.acceptanceId)
    .maybeSingle();
  if (!existing) return { error: "Risk acceptance not found." };
  if (existing.revoked_at) return { error: "This risk acceptance is already revoked." };

  const { error } = await supabase
    .from("risk_acceptances")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
      revoke_reason: input.reason,
    })
    .eq("id", input.acceptanceId);
  if (error) return { error: `Could not revoke: ${error.message}` };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "risk_acceptance",
    entityId: input.acceptanceId,
    action: "revoked",
    details: {
      assessment_id: input.assessmentId,
      impact_mapping_id: existing.impact_mapping_id,
      control_id: existing.control_id,
      reason: input.reason,
    },
  });

  revalidateAll(input.assessmentId);
  return { error: null, success: "Risk acceptance revoked." };
}
