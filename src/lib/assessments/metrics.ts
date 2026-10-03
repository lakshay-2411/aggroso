import type { ImpactLevel, ReviewStatus } from "@/lib/supabase/database.types";

/**
 * Deterministic assessment metrics. Pure function, no AI involved.
 *
 * Definitions (documented here because reviewers rely on them):
 * - An "effective" mapping is one a reviewer accepted or corrected. Pending
 *   and rejected mappings never count.
 * - A mapping is "resolved" when a reviewer marked it as needing no action,
 *   when every linked remediation action is done (and at least one exists),
 *   or when it carries an active risk acceptance.
 * - mapped      = controls in the assessment snapshot with >= 1 effective mapping
 * - unmapped    = controls in the snapshot with no effective mapping
 * - compliant   = mapped controls whose effective mappings are all resolved
 * - unresolved  = mapped controls with >= 1 unresolved effective mapping
 *   (so mapped = compliant + unresolved)
 * - pending     = mappings still awaiting a reviewer decision
 */

export interface MetricMapping {
  id: string;
  control_id: string;
  requirement_change_id: string;
  review_status: ReviewStatus;
  ai_impact_level: ImpactLevel;
  final_impact_level: ImpactLevel | null;
  no_action_required: boolean;
}

export interface MetricAction {
  impact_mapping_id: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
}

export interface MetricRiskAcceptance {
  impact_mapping_id: string | null;
  revoked_at: string | null;
}

export interface MetricsInput {
  /** Control ids that were active when the assessment was analysed. */
  snapshotControlIds: string[];
  changeIds: string[];
  mappings: MetricMapping[];
  actions?: MetricAction[];
  riskAcceptances?: MetricRiskAcceptance[];
}

export interface AssessmentMetrics {
  mapped: number;
  unmapped: number;
  compliant: number;
  unresolved: number;
  pending: number;
  rejected: number;
  confirmed: number;
  possible: number;
  unmappedChanges: number;
  /** Per-control resolution, useful for the UI and the report. */
  controlStates: Map<string, "compliant" | "unresolved" | "unmapped">;
  /** Per-mapping resolution. */
  mappingResolved: Map<string, boolean>;
}

export function isEffective(status: ReviewStatus): boolean {
  return status === "accepted" || status === "corrected";
}

export function effectiveLevel(m: Pick<MetricMapping, "ai_impact_level" | "final_impact_level">): ImpactLevel {
  return m.final_impact_level ?? m.ai_impact_level;
}

export function computeAssessmentMetrics(input: MetricsInput): AssessmentMetrics {
  const actionsByMapping = new Map<string, MetricAction[]>();
  for (const a of input.actions ?? []) {
    if (!a.impact_mapping_id) continue;
    const list = actionsByMapping.get(a.impact_mapping_id) ?? [];
    list.push(a);
    actionsByMapping.set(a.impact_mapping_id, list);
  }
  const acceptedMappings = new Set(
    (input.riskAcceptances ?? [])
      .filter((r) => r.impact_mapping_id && !r.revoked_at)
      .map((r) => r.impact_mapping_id as string),
  );

  const mappingResolved = new Map<string, boolean>();
  const effectiveByControl = new Map<string, MetricMapping[]>();
  const mappedChangeIds = new Set<string>();
  let pending = 0;
  let rejected = 0;
  let confirmed = 0;
  let possible = 0;

  for (const m of input.mappings) {
    if (m.review_status === "pending") pending += 1;
    if (m.review_status === "rejected") rejected += 1;
    if (!isEffective(m.review_status)) continue;

    if (effectiveLevel(m) === "confirmed") confirmed += 1;
    else possible += 1;
    mappedChangeIds.add(m.requirement_change_id);

    const actions = (actionsByMapping.get(m.id) ?? []).filter((a) => a.status !== "cancelled");
    const allActionsDone = actions.length > 0 && actions.every((a) => a.status === "done");
    const resolved = m.no_action_required || allActionsDone || acceptedMappings.has(m.id);
    mappingResolved.set(m.id, resolved);

    const list = effectiveByControl.get(m.control_id) ?? [];
    list.push(m);
    effectiveByControl.set(m.control_id, list);
  }

  const controlStates = new Map<string, "compliant" | "unresolved" | "unmapped">();
  const snapshot = new Set(input.snapshotControlIds);
  // Controls mapped by a reviewer after the snapshot still count as mapped.
  for (const id of effectiveByControl.keys()) snapshot.add(id);

  let mapped = 0;
  let unmapped = 0;
  let compliant = 0;
  let unresolved = 0;
  for (const controlId of snapshot) {
    const list = effectiveByControl.get(controlId);
    if (!list || list.length === 0) {
      unmapped += 1;
      controlStates.set(controlId, "unmapped");
      continue;
    }
    mapped += 1;
    const allResolved = list.every((m) => mappingResolved.get(m.id) === true);
    if (allResolved) {
      compliant += 1;
      controlStates.set(controlId, "compliant");
    } else {
      unresolved += 1;
      controlStates.set(controlId, "unresolved");
    }
  }

  const unmappedChanges = input.changeIds.filter((id) => !mappedChangeIds.has(id)).length;

  return {
    mapped,
    unmapped,
    compliant,
    unresolved,
    pending,
    rejected,
    confirmed,
    possible,
    unmappedChanges,
    controlStates,
    mappingResolved,
  };
}

/** Extracts control ids from the stored JSON snapshot ({control_id: revision}). */
export function snapshotControlIds(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  return Object.keys(snapshot as Record<string, unknown>);
}
