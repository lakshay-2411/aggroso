"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { refreshStaleness } from "@/lib/assessments/staleness";
import { recordAudit } from "@/lib/audit";
import {
  CONTROL_CSV_COLUMNS,
  REMEDIATION_STATUSES,
  isRemediationStatus,
} from "@/lib/controls/constants";
import {
  initialImportResult,
  type ImportResult,
} from "@/lib/controls/import-types";
import { parseCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import type { RemediationStatus } from "@/lib/supabase/database.types";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value));

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .pipe(z.uuid().nullable());

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .pipe(z.iso.date("Enter a valid date.").nullable());

const controlFields = {
  controlRef: z.string().trim().min(1, "Enter a control reference.").max(60),
  title: z.string().trim().min(1, "Enter a title.").max(200),
  description: optionalText.pipe(z.string().max(4000).nullable()),
  category: optionalText.pipe(z.string().max(120).nullable()),
  ownerId: optionalUuid,
  ownerName: optionalText.pipe(z.string().max(120).nullable()),
  remediationStatus: z.enum(REMEDIATION_STATUSES as [RemediationStatus, ...RemediationStatus[]]),
  remediationNotes: optionalText.pipe(z.string().max(4000).nullable()),
};

const createControlSchema = z.object(controlFields);
const updateControlSchema = z.object({ controlId: z.uuid(), ...controlFields });

const evidenceSchema = z.object({
  controlId: z.uuid(),
  title: z.string().trim().min(1, "Enter an evidence title.").max(200),
  description: optionalText.pipe(z.string().max(4000).nullable()),
  evidenceDate: optionalDate,
  reference: optionalText.pipe(z.string().max(1000).nullable()),
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

function readControlFields(formData: FormData) {
  return {
    controlRef: formData.get("controlRef"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "",
    ownerId: formData.get("ownerId") ?? "",
    ownerName: formData.get("ownerName") ?? "",
    remediationStatus: formData.get("remediationStatus"),
    remediationNotes: formData.get("remediationNotes") ?? "",
  };
}

export async function createControl(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createControlSchema.safeParse(readControlFields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data, error } = await supabase
    .from("controls")
    .insert({
      control_ref: input.controlRef,
      title: input.title,
      description: input.description,
      category: input.category,
      owner_id: input.ownerId,
      owner_name: input.ownerName,
      remediation_status: input.remediationStatus,
      remediation_notes: input.remediationNotes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? `A control with reference "${input.controlRef}" already exists.`
          : `Could not create control: ${error?.message ?? "unknown"}`,
    };
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "control",
    entityId: data.id,
    action: "created",
    details: { control_ref: input.controlRef, title: input.title },
  });

  revalidatePath("/controls");
  redirect(`/controls/${data.id}`);
}

export async function updateControl(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateControlSchema.safeParse({
    controlId: formData.get("controlId"),
    ...readControlFields(formData),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data: before } = await supabase
    .from("controls")
    .select("*")
    .eq("id", input.controlId)
    .maybeSingle();
  if (!before) return { error: "Control not found." };

  const after = {
    control_ref: input.controlRef,
    title: input.title,
    description: input.description,
    category: input.category,
    owner_id: input.ownerId,
    owner_name: input.ownerName,
    remediation_status: input.remediationStatus,
    remediation_notes: input.remediationNotes,
  };

  const { error } = await supabase
    .from("controls")
    .update(after)
    .eq("id", input.controlId);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? `A control with reference "${input.controlRef}" already exists.`
          : `Could not update control: ${error.message}`,
    };
  }

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as (keyof typeof after)[]) {
    if (before[key] !== after[key]) {
      changed[key] = { from: before[key], to: after[key] };
    }
  }

  if (Object.keys(changed).length > 0) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      entityType: "control",
      entityId: input.controlId,
      action: "updated",
      details: { control_ref: input.controlRef, changed: changed as never },
    });
  }

  await refreshStaleness({ id: user.id, email: user.email ?? null });
  revalidatePath("/controls");
  revalidatePath(`/controls/${input.controlId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  return { error: null, success: "Control saved." };
}

export async function setControlActive(formData: FormData): Promise<void> {
  const parsed = z
    .object({ controlId: z.uuid(), active: z.enum(["true", "false"]) })
    .safeParse({
      controlId: formData.get("controlId"),
      active: formData.get("active"),
    });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { supabase, user } = await requireUser();
  const isActive = parsed.data.active === "true";

  const { error } = await supabase
    .from("controls")
    .update({ is_active: isActive })
    .eq("id", parsed.data.controlId);
  if (error) throw new Error(`Could not update control: ${error.message}`);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "control",
    entityId: parsed.data.controlId,
    action: isActive ? "reactivated" : "deactivated",
  });

  await refreshStaleness({ id: user.id, email: user.email ?? null });
  revalidatePath("/controls");
  revalidatePath(`/controls/${parsed.data.controlId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
}

export async function addEvidence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = evidenceSchema.safeParse({
    controlId: formData.get("controlId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    evidenceDate: formData.get("evidenceDate") ?? "",
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireUser();
  const input = parsed.data;

  const { data, error } = await supabase
    .from("control_evidence")
    .insert({
      control_id: input.controlId,
      title: input.title,
      description: input.description,
      evidence_date: input.evidenceDate,
      reference: input.reference,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: `Could not add evidence: ${error?.message ?? "unknown"}` };
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "control_evidence",
    entityId: data.id,
    action: "added",
    details: {
      control_id: input.controlId,
      title: input.title,
      evidence_date: input.evidenceDate,
    },
  });

  await refreshStaleness({ id: user.id, email: user.email ?? null });
  revalidatePath("/controls");
  revalidatePath(`/controls/${input.controlId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  return { error: null, success: "Evidence added." };
}

export async function removeEvidence(formData: FormData): Promise<void> {
  const parsed = z
    .object({ evidenceId: z.uuid(), controlId: z.uuid() })
    .safeParse({
      evidenceId: formData.get("evidenceId"),
      controlId: formData.get("controlId"),
    });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("control_evidence")
    .select("title, evidence_date")
    .eq("id", parsed.data.evidenceId)
    .maybeSingle();

  const { error } = await supabase
    .from("control_evidence")
    .delete()
    .eq("id", parsed.data.evidenceId)
    .eq("control_id", parsed.data.controlId);
  if (error) throw new Error(`Could not remove evidence: ${error.message}`);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "control_evidence",
    entityId: parsed.data.evidenceId,
    action: "removed",
    details: { control_id: parsed.data.controlId, ...(existing ?? {}) },
  });

  await refreshStaleness({ id: user.id, email: user.email ?? null });
  revalidatePath("/controls");
  revalidatePath(`/controls/${parsed.data.controlId}`, "page");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export async function importControlsCsv(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...initialImportResult, error: "Choose a CSV file to import." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ...initialImportResult, error: "CSV file must be 2 MB or smaller." };
  }

  const { supabase, user } = await requireUser();
  const { headers, rows } = parseCsv(await file.text());

  if (!headers.includes("control_ref") || !headers.includes("title")) {
    return {
      ...initialImportResult,
      error: `CSV must include at least "control_ref" and "title" columns. Found: ${headers.join(", ") || "none"}.`,
    };
  }
  const unknown = headers.filter(
    (h) => !(CONTROL_CSV_COLUMNS as readonly string[]).includes(h),
  );
  if (unknown.length > 0) {
    return {
      ...initialImportResult,
      error: `Unknown column(s): ${unknown.join(", ")}. Download the template for the accepted columns.`,
    };
  }

  const { data: profiles } = await supabase.from("profiles").select("id, email");
  const profileByEmail = new Map(
    (profiles ?? []).map((p) => [p.email.toLowerCase(), p.id]),
  );

  const result: ImportResult = { ...initialImportResult, skipped: [] };

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2; // 1-based, after the header line
    const controlRef = row.control_ref;
    const title = row.title;

    if (!controlRef || !title) {
      result.skipped.push({ row: rowNumber, reason: "Missing control_ref or title." });
      continue;
    }

    let remediationStatus: RemediationStatus = "not_started";
    if (row.remediation_status) {
      const normalized = row.remediation_status.toLowerCase().replace(/[\s-]+/g, "_");
      if (!isRemediationStatus(normalized)) {
        result.skipped.push({
          row: rowNumber,
          reason: `Unknown remediation_status "${row.remediation_status}".`,
        });
        continue;
      }
      remediationStatus = normalized;
    }

    const ownerEmail = row.owner_email?.toLowerCase() ?? "";
    const ownerId = ownerEmail ? (profileByEmail.get(ownerEmail) ?? null) : null;
    const ownerName = row.owner_name || (ownerEmail && !ownerId ? ownerEmail : null);

    const evidenceDate = row.evidence_date || null;
    if (evidenceDate && !/^\d{4}-\d{2}-\d{2}$/.test(evidenceDate)) {
      result.skipped.push({
        row: rowNumber,
        reason: `evidence_date "${evidenceDate}" must be YYYY-MM-DD.`,
      });
      continue;
    }

    const payload = {
      title,
      description: row.description || null,
      category: row.category || null,
      owner_id: ownerId,
      owner_name: ownerName,
      remediation_status: remediationStatus,
      remediation_notes: row.remediation_notes || null,
    };

    const { data: existing } = await supabase
      .from("controls")
      .select("id")
      .eq("control_ref", controlRef)
      .maybeSingle();

    let controlId: string;
    if (existing) {
      const { error } = await supabase
        .from("controls")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        result.skipped.push({ row: rowNumber, reason: error.message });
        continue;
      }
      controlId = existing.id;
      result.updated += 1;
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email ?? null,
        entityType: "control",
        entityId: controlId,
        action: "updated_via_import",
        details: { control_ref: controlRef, file: file.name },
      });
    } else {
      const { data, error } = await supabase
        .from("controls")
        .insert({ control_ref: controlRef, created_by: user.id, ...payload })
        .select("id")
        .single();
      if (error || !data) {
        result.skipped.push({
          row: rowNumber,
          reason: error?.message ?? "Insert failed.",
        });
        continue;
      }
      controlId = data.id;
      result.created += 1;
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email ?? null,
        entityType: "control",
        entityId: controlId,
        action: "created_via_import",
        details: { control_ref: controlRef, file: file.name },
      });
    }

    if (row.evidence_title) {
      const { data: evidence, error } = await supabase
        .from("control_evidence")
        .insert({
          control_id: controlId,
          title: row.evidence_title,
          description: row.evidence_description || null,
          evidence_date: evidenceDate,
          reference: row.evidence_reference || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error || !evidence) {
        result.skipped.push({
          row: rowNumber,
          reason: `Control saved but evidence failed: ${error?.message ?? "unknown"}`,
        });
        continue;
      }
      result.evidenceAdded += 1;
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email ?? null,
        entityType: "control_evidence",
        entityId: evidence.id,
        action: "added_via_import",
        details: { control_id: controlId, title: row.evidence_title, file: file.name },
      });
    }
  }

  await refreshStaleness({ id: user.id, email: user.email ?? null });
  revalidatePath("/controls");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  result.success = `Import finished: ${result.created} created, ${result.updated} updated, ${result.evidenceAdded} evidence rows added, ${result.skipped.length} skipped.`;
  return result;
}
