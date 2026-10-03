import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export type AuditEntityType =
  | "auth"
  | "policy"
  | "policy_version"
  | "control"
  | "control_evidence"
  | "assessment"
  | "impact_mapping"
  | "remediation_action"
  | "risk_acceptance"
  | "context_question";

export interface AuditEntry {
  actorId: string | null;
  actorEmail: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  details?: { [key: string]: Json | undefined };
}

/**
 * Appends a row to the immutable audit log.
 * Uses the privileged client because the log is insert-only for the server.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    details: entry.details ?? {},
  });
  if (error) {
    // Auditing must never silently fail; surface it to the caller.
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}
