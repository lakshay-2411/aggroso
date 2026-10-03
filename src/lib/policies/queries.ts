import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  PolicyRow,
  PolicyVersionRow,
} from "@/lib/supabase/database.types";

export type PolicyVersionSummary = Omit<PolicyVersionRow, "content">;

export interface PolicyListItem extends PolicyRow {
  version_count: number;
  latest_version: PolicyVersionSummary | null;
}

export interface PolicyDetail extends PolicyRow {
  versions: PolicyVersionSummary[];
}

const VERSION_SUMMARY_COLUMNS =
  "id, policy_id, version_number, label, effective_date, change_summary, created_by, created_at";

export async function listPolicies(): Promise<PolicyListItem[]> {
  const supabase = await createClient();

  const [{ data: policies, error }, { data: versions, error: versionsError }] =
    await Promise.all([
      supabase.from("policies").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("policy_versions")
        .select(VERSION_SUMMARY_COLUMNS)
        .order("version_number", { ascending: false }),
    ]);

  if (error) throw new Error(`Failed to load policies: ${error.message}`);
  if (versionsError) {
    throw new Error(`Failed to load policy versions: ${versionsError.message}`);
  }

  const byPolicy = new Map<string, PolicyVersionSummary[]>();
  for (const version of versions ?? []) {
    const list = byPolicy.get(version.policy_id) ?? [];
    list.push(version);
    byPolicy.set(version.policy_id, list);
  }

  return (policies ?? []).map((policy) => {
    const list = byPolicy.get(policy.id) ?? [];
    return {
      ...policy,
      version_count: list.length,
      latest_version: list[0] ?? null,
    };
  });
}

export async function getPolicy(policyId: string): Promise<PolicyDetail | null> {
  const supabase = await createClient();

  const { data: policy, error } = await supabase
    .from("policies")
    .select("*")
    .eq("id", policyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load policy: ${error.message}`);
  if (!policy) return null;

  const { data: versions, error: versionsError } = await supabase
    .from("policy_versions")
    .select(VERSION_SUMMARY_COLUMNS)
    .eq("policy_id", policyId)
    .order("version_number", { ascending: false });
  if (versionsError) {
    throw new Error(`Failed to load policy versions: ${versionsError.message}`);
  }

  return { ...policy, versions: versions ?? [] };
}

export async function getPolicyVersion(
  policyId: string,
  versionId: string,
): Promise<PolicyVersionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policy_versions")
    .select("*")
    .eq("id", versionId)
    .eq("policy_id", policyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load policy version: ${error.message}`);
  return data;
}

export async function getLatestPolicyVersion(
  policyId: string,
): Promise<PolicyVersionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policy_versions")
    .select("*")
    .eq("policy_id", policyId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load latest version: ${error.message}`);
  return data;
}
