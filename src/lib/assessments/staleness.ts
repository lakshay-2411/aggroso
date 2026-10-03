import "server-only";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import {
  computeStaleness,
  describeStaleReason,
  type StalenessContext,
} from "@/lib/assessments/staleness-core";

export * from "@/lib/assessments/staleness-core";

/** Loads everything needed to evaluate staleness for any assessment. */
export async function loadStalenessContext(): Promise<StalenessContext> {
  const supabase = await createClient();
  const [versionsRes, controlsRes] = await Promise.all([
    supabase.from("policy_versions").select("id, policy_id, version_number, label"),
    supabase.from("controls").select("id, control_ref, revision, is_active"),
  ]);
  if (versionsRes.error) throw new Error(versionsRes.error.message);
  if (controlsRes.error) throw new Error(controlsRes.error.message);

  const latestVersions = new Map<string, { id: string; version_number: number; label: string }>();
  const versionNumbers = new Map<string, number>();
  for (const v of versionsRes.data ?? []) {
    versionNumbers.set(v.id, v.version_number);
    const current = latestVersions.get(v.policy_id);
    if (!current || v.version_number > current.version_number) {
      latestVersions.set(v.policy_id, { id: v.id, version_number: v.version_number, label: v.label });
    }
  }
  const controls = new Map(
    (controlsRes.data ?? []).map((c) => [
      c.id,
      { control_ref: c.control_ref, revision: c.revision, is_active: c.is_active },
    ]),
  );
  return { latestVersions, versionNumbers, controls };
}

/**
 * Recomputes staleness for every analysed assessment and persists changes.
 * Called after policy or control mutations. Transitions are audited once.
 */
export async function refreshStaleness(actor: { id: string; email: string | null }): Promise<void> {
  const supabase = await createClient();
  const [{ data: assessments, error }, context] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, policy_id, to_version_id, status, control_snapshot, is_stale, stale_reasons")
      .in("status", ["in_review", "completed"])
      .is("superseded_by_id", null),
    loadStalenessContext(),
  ]);
  if (error) throw new Error(`Failed to refresh staleness: ${error.message}`);

  for (const a of assessments ?? []) {
    const reasons = computeStaleness(a, context);
    const isStale = reasons.length > 0;
    const serialized = JSON.stringify(reasons);
    if (a.is_stale === isStale && JSON.stringify(a.stale_reasons) === serialized) continue;

    await supabase
      .from("assessments")
      .update({ is_stale: isStale, stale_reasons: reasons as unknown as Json })
      .eq("id", a.id);

    if (a.is_stale !== isStale) {
      await recordAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        entityType: "assessment",
        entityId: a.id,
        action: isStale ? "marked_stale" : "marked_current",
        details: { reasons: reasons.map(describeStaleReason) },
      });
    }
  }
}
