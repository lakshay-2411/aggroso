import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentRow,
  ContextQuestionRow,
  ControlRow,
  ImpactMappingRow,
  PolicyRow,
  PolicyVersionRow,
  ProfileRow,
  RequirementChangeRow,
} from "@/lib/supabase/database.types";

export type VersionRef = Pick<
  PolicyVersionRow,
  "id" | "version_number" | "label" | "effective_date"
>;

export interface AssessmentListItem extends AssessmentRow {
  policy: Pick<PolicyRow, "id" | "title">;
  from_version: VersionRef;
  to_version: VersionRef;
  change_count: number;
  mapping_count: number;
  pending_count: number;
}

export type MappingControl = Pick<
  ControlRow,
  "id" | "control_ref" | "title" | "owner_id" | "owner_name" | "remediation_status" | "is_active"
>;

export interface MappingWithControl extends ImpactMappingRow {
  control: MappingControl;
  reviewer: Pick<ProfileRow, "id" | "email" | "full_name"> | null;
}

export interface AssessmentDetail extends AssessmentRow {
  policy: Pick<PolicyRow, "id" | "title">;
  from_version: VersionRef;
  to_version: VersionRef;
  changes: RequirementChangeRow[];
  mappings: MappingWithControl[];
  questions: ContextQuestionRow[];
  profiles: Map<string, Pick<ProfileRow, "id" | "email" | "full_name">>;
}

const VERSION_REF_COLUMNS = "id, version_number, label, effective_date";

export async function listAssessments(): Promise<AssessmentListItem[]> {
  const supabase = await createClient();

  const [assessmentsRes, policiesRes, versionsRes, changesRes, mappingsRes] =
    await Promise.all([
      supabase.from("assessments").select("*").order("created_at", { ascending: false }),
      supabase.from("policies").select("id, title"),
      supabase.from("policy_versions").select(VERSION_REF_COLUMNS),
      supabase.from("requirement_changes").select("assessment_id"),
      supabase.from("impact_mappings").select("assessment_id, review_status"),
    ]);

  for (const res of [assessmentsRes, policiesRes, versionsRes, changesRes, mappingsRes]) {
    if (res.error) throw new Error(`Failed to load assessments: ${res.error.message}`);
  }

  const policies = new Map((policiesRes.data ?? []).map((p) => [p.id, p]));
  const versions = new Map((versionsRes.data ?? []).map((v) => [v.id, v]));
  const changeCounts = new Map<string, number>();
  for (const c of changesRes.data ?? []) {
    changeCounts.set(c.assessment_id, (changeCounts.get(c.assessment_id) ?? 0) + 1);
  }
  const mappingCounts = new Map<string, { total: number; pending: number }>();
  for (const m of mappingsRes.data ?? []) {
    const stat = mappingCounts.get(m.assessment_id) ?? { total: 0, pending: 0 };
    stat.total += 1;
    if (m.review_status === "pending") stat.pending += 1;
    mappingCounts.set(m.assessment_id, stat);
  }

  const items: AssessmentListItem[] = [];
  for (const a of assessmentsRes.data ?? []) {
    const policy = policies.get(a.policy_id);
    const from = versions.get(a.from_version_id);
    const to = versions.get(a.to_version_id);
    if (!policy || !from || !to) continue;
    const mc = mappingCounts.get(a.id) ?? { total: 0, pending: 0 };
    items.push({
      ...a,
      policy,
      from_version: from,
      to_version: to,
      change_count: changeCounts.get(a.id) ?? 0,
      mapping_count: mc.total,
      pending_count: mc.pending,
    });
  }
  return items;
}

export async function getAssessment(assessmentId: string): Promise<AssessmentDetail | null> {
  const supabase = await createClient();

  const { data: assessment, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load assessment: ${error.message}`);
  if (!assessment) return null;

  const [policyRes, versionsRes, changesRes, mappingsRes, questionsRes, profilesRes] =
    await Promise.all([
      supabase.from("policies").select("id, title").eq("id", assessment.policy_id).single(),
      supabase
        .from("policy_versions")
        .select(VERSION_REF_COLUMNS)
        .in("id", [assessment.from_version_id, assessment.to_version_id]),
      supabase
        .from("requirement_changes")
        .select("*")
        .eq("assessment_id", assessmentId)
        .order("position", { ascending: true }),
      supabase
        .from("impact_mappings")
        .select("*")
        .eq("assessment_id", assessmentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("context_questions")
        .select("*")
        .eq("assessment_id", assessmentId)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, email, full_name"),
    ]);

  for (const res of [policyRes, versionsRes, changesRes, mappingsRes, questionsRes, profilesRes]) {
    if (res.error) throw new Error(`Failed to load assessment: ${res.error.message}`);
  }

  const from = versionsRes.data?.find((v) => v.id === assessment.from_version_id);
  const to = versionsRes.data?.find((v) => v.id === assessment.to_version_id);
  if (!policyRes.data || !from || !to) return null;

  const mappingRows = mappingsRes.data ?? [];
  const controlIds = [...new Set(mappingRows.map((m) => m.control_id))];
  const { data: controls, error: controlsError } =
    controlIds.length > 0
      ? await supabase
          .from("controls")
          .select("id, control_ref, title, owner_id, owner_name, remediation_status, is_active")
          .in("id", controlIds)
      : { data: [] as MappingControl[], error: null };
  if (controlsError) throw new Error(`Failed to load controls: ${controlsError.message}`);

  const controlMap = new Map((controls ?? []).map((c) => [c.id, c]));
  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const mappings: MappingWithControl[] = [];
  for (const m of mappingRows) {
    const control = controlMap.get(m.control_id);
    if (!control) continue;
    mappings.push({
      ...m,
      control,
      reviewer: m.reviewer_id ? (profiles.get(m.reviewer_id) ?? null) : null,
    });
  }

  return {
    ...assessment,
    policy: policyRes.data,
    from_version: from,
    to_version: to,
    changes: changesRes.data ?? [],
    mappings,
    questions: questionsRes.data ?? [],
    profiles,
  };
}

/** Policies with their versions, for the new-assessment form. */
export async function listPoliciesWithVersions(): Promise<
  (Pick<PolicyRow, "id" | "title"> & { versions: VersionRef[] })[]
> {
  const supabase = await createClient();
  const [policiesRes, versionsRes] = await Promise.all([
    supabase.from("policies").select("id, title").order("title"),
    supabase
      .from("policy_versions")
      .select(`${VERSION_REF_COLUMNS}, policy_id`)
      .order("version_number", { ascending: false }),
  ]);
  if (policiesRes.error) throw new Error(policiesRes.error.message);
  if (versionsRes.error) throw new Error(versionsRes.error.message);

  const byPolicy = new Map<string, VersionRef[]>();
  for (const v of versionsRes.data ?? []) {
    const list = byPolicy.get(v.policy_id) ?? [];
    list.push({
      id: v.id,
      version_number: v.version_number,
      label: v.label,
      effective_date: v.effective_date,
    });
    byPolicy.set(v.policy_id, list);
  }

  return (policiesRes.data ?? [])
    .map((p) => ({ ...p, versions: byPolicy.get(p.id) ?? [] }))
    .filter((p) => p.versions.length >= 2);
}
