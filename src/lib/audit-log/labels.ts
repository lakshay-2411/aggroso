import type { AuditEntityType } from "@/lib/audit";

export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  auth: "Sign-in",
  policy: "Policy",
  policy_version: "Policy version",
  control: "Control",
  control_evidence: "Evidence",
  assessment: "Assessment",
  impact_mapping: "Impact mapping",
  remediation_action: "Remediation action",
  risk_acceptance: "Risk acceptance",
  context_question: "Context question",
};

export const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS) as AuditEntityType[];

const ACTION_LABELS: Record<string, string> = {
  signed_in: "signed in",
  signed_up: "created an account",
  signed_out: "signed out",
  created: "created",
  updated: "updated",
  created_via_import: "created via CSV import",
  updated_via_import: "updated via CSV import",
  added: "added",
  added_via_import: "added via CSV import",
  removed: "removed",
  deactivated: "deactivated",
  reactivated: "reactivated",
  analysis_started: "started analysis",
  analysis_completed: "completed analysis",
  analysis_failed: "analysis failed",
  answered: "answered",
  review_accept: "accepted mapping",
  review_reject: "rejected mapping",
  review_correct: "corrected mapping",
  review_reset: "reset mapping to pending",
  added_by_reviewer: "added mapping manually",
  completed: "completed review",
  reopened: "reopened review",
  status_open: "set action to open",
  status_in_progress: "set action to in progress",
  status_done: "marked action done",
  status_cancelled: "cancelled action",
  accepted: "accepted risk",
  revoked: "revoked risk acceptance",
  marked_stale: "marked stale",
  marked_current: "marked current again",
  reevaluation_started: "started re-evaluation",
  reevaluation_completed: "completed re-evaluation",
  carried_forward: "carried decision forward",
  superseded: "superseded by a re-evaluation",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function isEntityType(value: string): value is AuditEntityType {
  return (ENTITY_TYPES as string[]).includes(value);
}
