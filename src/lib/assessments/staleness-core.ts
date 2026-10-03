import type { Json } from "@/lib/supabase/database.types";

/**
 * Deterministic stale detection.
 *
 * An analysed assessment is stale when the world it was computed against has
 * changed:
 * - a newer version of the policy exists than the one assessed;
 * - a control in the snapshot has a higher revision now (edited, or its
 *   evidence changed), or was deactivated;
 * - an active control exists that was not in the snapshot (added since).
 */

export type StaleReason =
  | { type: "policy_new_version"; version_number: number; label: string; version_id: string }
  | {
      type: "control_changed";
      control_id: string;
      control_ref: string;
      from_revision: number;
      to_revision: number;
    }
  | { type: "control_deactivated"; control_id: string; control_ref: string }
  | { type: "control_added"; control_id: string; control_ref: string };

export interface StalenessContext {
  /** policy_id -> latest version */
  latestVersions: Map<string, { id: string; version_number: number; label: string }>;
  /** version_id -> version_number */
  versionNumbers: Map<string, number>;
  /** control_id -> current state */
  controls: Map<string, { control_ref: string; revision: number; is_active: boolean }>;
}

export interface StalenessSubject {
  id: string;
  policy_id: string;
  to_version_id: string;
  status: string;
  control_snapshot: Json;
}

export function snapshotRevisions(snapshot: Json): Record<string, number> {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  const out: Record<string, number> = {};
  for (const [id, rev] of Object.entries(snapshot)) {
    if (typeof rev === "number") out[id] = rev;
  }
  return out;
}

export function computeStaleness(
  assessment: StalenessSubject,
  context: StalenessContext,
): StaleReason[] {
  if (assessment.status !== "in_review" && assessment.status !== "completed") return [];

  const reasons: StaleReason[] = [];

  const latest = context.latestVersions.get(assessment.policy_id);
  const assessedNumber = context.versionNumbers.get(assessment.to_version_id) ?? 0;
  if (latest && latest.version_number > assessedNumber) {
    reasons.push({
      type: "policy_new_version",
      version_number: latest.version_number,
      label: latest.label,
      version_id: latest.id,
    });
  }

  const snapshot = snapshotRevisions(assessment.control_snapshot);
  for (const [controlId, revision] of Object.entries(snapshot)) {
    const current = context.controls.get(controlId);
    if (!current) continue;
    if (!current.is_active) {
      reasons.push({ type: "control_deactivated", control_id: controlId, control_ref: current.control_ref });
    } else if (current.revision > revision) {
      reasons.push({
        type: "control_changed",
        control_id: controlId,
        control_ref: current.control_ref,
        from_revision: revision,
        to_revision: current.revision,
      });
    }
  }
  for (const [controlId, current] of context.controls) {
    if (current.is_active && !(controlId in snapshot)) {
      reasons.push({ type: "control_added", control_id: controlId, control_ref: current.control_ref });
    }
  }

  return reasons;
}

export function describeStaleReason(reason: StaleReason): string {
  switch (reason.type) {
    case "policy_new_version":
      return `A newer policy version exists: #${reason.version_number} ${reason.label}.`;
    case "control_changed":
      return `Control ${reason.control_ref} changed (revision ${reason.from_revision} → ${reason.to_revision}).`;
    case "control_deactivated":
      return `Control ${reason.control_ref} was deactivated.`;
    case "control_added":
      return `Control ${reason.control_ref} was added after the analysis.`;
  }
}

