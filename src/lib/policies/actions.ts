"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value));

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .pipe(z.iso.date("Enter a valid date.").nullable());

const versionFields = {
  label: z.string().trim().min(1, "Enter a version label.").max(60),
  effectiveDate: optionalDate,
  changeSummary: optionalText.pipe(z.string().max(2000).nullable()),
  content: z
    .string()
    .trim()
    .min(20, "Policy content must be at least 20 characters.")
    .max(200_000, "Policy content is too long."),
};

const createPolicySchema = z.object({
  title: z.string().trim().min(1, "Enter a policy title.").max(200),
  description: optionalText.pipe(z.string().max(2000).nullable()),
  ...versionFields,
});

const addVersionSchema = z.object({
  policyId: z.uuid(),
  ...versionFields,
});

const updatePolicySchema = z.object({
  policyId: z.uuid(),
  title: z.string().trim().min(1, "Enter a policy title.").max(200),
  description: optionalText.pipe(z.string().max(2000).nullable()),
});

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

/** Creates a policy together with its first version. */
export async function createPolicy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createPolicySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    label: formData.get("label"),
    effectiveDate: formData.get("effectiveDate") ?? "",
    changeSummary: formData.get("changeSummary") ?? "",
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: policy, error } = await supabase
    .from("policies")
    .insert({
      title: input.title,
      description: input.description,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !policy) {
    return { error: `Could not create policy: ${error?.message ?? "unknown"}` };
  }

  const { data: version, error: versionError } = await supabase
    .from("policy_versions")
    .insert({
      policy_id: policy.id,
      version_number: 1,
      label: input.label,
      effective_date: input.effectiveDate,
      change_summary: input.changeSummary,
      content: input.content,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError || !version) {
    return {
      error: `Policy created but the first version failed: ${versionError?.message ?? "unknown"}`,
    };
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "policy",
    entityId: policy.id,
    action: "created",
    details: { title: input.title },
  });
  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "policy_version",
    entityId: version.id,
    action: "created",
    details: { policy_id: policy.id, version_number: 1, label: input.label },
  });

  revalidatePath("/policies");
  redirect(`/policies/${policy.id}`);
}

/** Adds a new immutable version to an existing policy. */
export async function addPolicyVersion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addVersionSchema.safeParse({
    policyId: formData.get("policyId"),
    label: formData.get("label"),
    effectiveDate: formData.get("effectiveDate") ?? "",
    changeSummary: formData.get("changeSummary") ?? "",
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: nextNumber, error: numberError } = await supabase.rpc(
    "next_policy_version_number",
    { p_policy_id: input.policyId },
  );
  if (numberError || typeof nextNumber !== "number") {
    return {
      error: `Could not allocate version number: ${numberError?.message ?? "unknown"}`,
    };
  }

  const { data: version, error } = await supabase
    .from("policy_versions")
    .insert({
      policy_id: input.policyId,
      version_number: nextNumber,
      label: input.label,
      effective_date: input.effectiveDate,
      change_summary: input.changeSummary,
      content: input.content,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !version) {
    const conflict = error?.code === "23505";
    return {
      error: conflict
        ? "Another version was added at the same time. Please try again."
        : `Could not add version: ${error?.message ?? "unknown"}`,
    };
  }

  // Touch the parent so list ordering reflects the new version.
  await supabase
    .from("policies")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.policyId);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "policy_version",
    entityId: version.id,
    action: "created",
    details: {
      policy_id: input.policyId,
      version_number: nextNumber,
      label: input.label,
    },
  });

  revalidatePath("/policies");
  revalidatePath(`/policies/${input.policyId}`, "page");
  redirect(`/policies/${input.policyId}/versions/${version.id}`);
}

/** Updates a policy's title or description. Versions are never changed. */
export async function updatePolicy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePolicySchema.safeParse({
    policyId: formData.get("policyId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: before } = await supabase
    .from("policies")
    .select("title, description")
    .eq("id", input.policyId)
    .maybeSingle();

  const { error } = await supabase
    .from("policies")
    .update({ title: input.title, description: input.description })
    .eq("id", input.policyId);
  if (error) return { error: `Could not update policy: ${error.message}` };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "policy",
    entityId: input.policyId,
    action: "updated",
    details: {
      before: before ?? null,
      after: { title: input.title, description: input.description },
    },
  });

  revalidatePath("/policies");
  revalidatePath(`/policies/${input.policyId}`, "page");
  return { error: null, success: "Policy details saved." };
}
