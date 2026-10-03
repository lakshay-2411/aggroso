import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  ControlEvidenceRow,
  ControlRow,
  ProfileRow,
} from "@/lib/supabase/database.types";

export type OwnerOption = Pick<ProfileRow, "id" | "email" | "full_name">;

export interface ControlListItem extends ControlRow {
  owner: OwnerOption | null;
  evidence_count: number;
  latest_evidence_date: string | null;
}

export interface ControlDetail extends ControlRow {
  owner: OwnerOption | null;
  evidence: ControlEvidenceRow[];
}

export function ownerDisplayName(
  owner: OwnerOption | null,
  ownerName: string | null,
): string {
  if (owner) return owner.full_name ?? owner.email;
  if (ownerName) return ownerName;
  return "Unassigned";
}

export async function listOwners(): Promise<OwnerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .order("full_name", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Failed to load owners: ${error.message}`);
  return data ?? [];
}

export async function listControls(options?: {
  includeInactive?: boolean;
}): Promise<ControlListItem[]> {
  const supabase = await createClient();

  let controlsQuery = supabase
    .from("controls")
    .select("*")
    .order("control_ref", { ascending: true });
  if (!options?.includeInactive) {
    controlsQuery = controlsQuery.eq("is_active", true);
  }

  const [controlsResult, evidenceResult, ownersResult] = await Promise.all([
    controlsQuery,
    supabase.from("control_evidence").select("control_id, evidence_date"),
    listOwners(),
  ]);

  if (controlsResult.error) {
    throw new Error(`Failed to load controls: ${controlsResult.error.message}`);
  }
  if (evidenceResult.error) {
    throw new Error(`Failed to load evidence: ${evidenceResult.error.message}`);
  }

  const owners = new Map(ownersResult.map((o) => [o.id, o]));
  const evidenceStats = new Map<string, { count: number; latest: string | null }>();
  for (const row of evidenceResult.data ?? []) {
    const stat = evidenceStats.get(row.control_id) ?? { count: 0, latest: null };
    stat.count += 1;
    if (row.evidence_date && (!stat.latest || row.evidence_date > stat.latest)) {
      stat.latest = row.evidence_date;
    }
    evidenceStats.set(row.control_id, stat);
  }

  return (controlsResult.data ?? []).map((control) => {
    const stat = evidenceStats.get(control.id);
    return {
      ...control,
      owner: control.owner_id ? (owners.get(control.owner_id) ?? null) : null,
      evidence_count: stat?.count ?? 0,
      latest_evidence_date: stat?.latest ?? null,
    };
  });
}

export async function getControl(controlId: string): Promise<ControlDetail | null> {
  const supabase = await createClient();

  const { data: control, error } = await supabase
    .from("controls")
    .select("*")
    .eq("id", controlId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load control: ${error.message}`);
  if (!control) return null;

  const [evidenceResult, ownerResult] = await Promise.all([
    supabase
      .from("control_evidence")
      .select("*")
      .eq("control_id", controlId)
      .order("evidence_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    control.owner_id
      ? supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", control.owner_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (evidenceResult.error) {
    throw new Error(`Failed to load evidence: ${evidenceResult.error.message}`);
  }

  return {
    ...control,
    owner: ownerResult.data ?? null,
    evidence: evidenceResult.data ?? [],
  };
}
