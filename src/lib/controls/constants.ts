import type { RemediationStatus } from "@/lib/supabase/database.types";

export const REMEDIATION_STATUSES: readonly RemediationStatus[] = [
  "not_started",
  "in_progress",
  "remediated",
  "risk_accepted",
  "not_applicable",
] as const;

export const REMEDIATION_STATUS_LABELS: Record<RemediationStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  remediated: "Remediated",
  risk_accepted: "Risk accepted",
  not_applicable: "Not applicable",
};

export function isRemediationStatus(value: string): value is RemediationStatus {
  return (REMEDIATION_STATUSES as readonly string[]).includes(value);
}

/** Column names accepted by the CSV importer, in template order. */
export const CONTROL_CSV_COLUMNS = [
  "control_ref",
  "title",
  "description",
  "category",
  "owner_email",
  "owner_name",
  "remediation_status",
  "remediation_notes",
  "evidence_title",
  "evidence_description",
  "evidence_date",
  "evidence_reference",
] as const;
