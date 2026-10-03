/**
 * Hand-maintained database types. Keep in sync with supabase/migrations.
 * Each table lists Row (select), Insert, and Update shapes.
 *
 * Rows are declared as type aliases, not interfaces, because supabase-js
 * requires them to be assignable to Record<string, unknown>.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  details: Json;
  created_at: string;
};

export type PolicyRow = {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PolicyVersionRow = {
  id: string;
  policy_id: string;
  version_number: number;
  label: string;
  effective_date: string | null;
  change_summary: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
};

export type RemediationStatus =
  | "not_started"
  | "in_progress"
  | "remediated"
  | "risk_accepted"
  | "not_applicable";

export type ControlRow = {
  id: string;
  control_ref: string;
  title: string;
  description: string | null;
  category: string | null;
  owner_id: string | null;
  owner_name: string | null;
  remediation_status: RemediationStatus;
  remediation_notes: string | null;
  is_active: boolean;
  revision: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlEvidenceRow = {
  id: string;
  control_id: string;
  title: string;
  description: string | null;
  evidence_date: string | null;
  reference: string | null;
  created_by: string | null;
  created_at: string;
};

export type AssessmentStatus =
  | "draft"
  | "analyzing"
  | "in_review"
  | "completed"
  | "failed";
export type ChangeType = "added" | "modified" | "removed";
export type ImpactLevel = "confirmed" | "possible";
export type ReviewStatus = "pending" | "accepted" | "rejected" | "corrected";

export type AssessmentRow = {
  id: string;
  policy_id: string;
  from_version_id: string;
  to_version_id: string;
  assessment_version: number;
  supersedes_id: string | null;
  status: AssessmentStatus;
  is_stale: boolean;
  stale_reasons: Json;
  control_snapshot: Json;
  ai_model: string | null;
  ai_summary: string | null;
  ai_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
  completed_at: string | null;
};

export type RequirementChangeRow = {
  id: string;
  assessment_id: string;
  position: number;
  change_type: ChangeType;
  title: string;
  summary: string;
  old_section_ref: string | null;
  old_text: string | null;
  new_section_ref: string | null;
  new_text: string | null;
  rationale: string | null;
  citation_verified: boolean;
  created_at: string;
};

export type ImpactMappingRow = {
  id: string;
  assessment_id: string;
  requirement_change_id: string;
  control_id: string;
  ai_impact_level: ImpactLevel;
  ai_rationale: string;
  evidence_outdated: boolean;
  evidence_rationale: string | null;
  suggested_remediation: string | null;
  review_status: ReviewStatus;
  final_impact_level: ImpactLevel | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ContextQuestionRow = {
  id: string;
  assessment_id: string;
  question: string;
  why_needed: string | null;
  related_control_ids: string[];
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
};

/** Insert shape: generated and optional columns become optional. */
type Insertable<
  Row,
  Generated extends keyof Row,
  Optional extends keyof Row,
> = Omit<Row, Generated | Optional> & Partial<Pick<Row, Generated | Optional>>;

/** Marker for tables that are never updated through the client. */
type NoUpdate = Record<string, never>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow, "created_at" | "updated_at", "full_name">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Insertable<
          AuditLogRow,
          "id" | "created_at",
          "actor_id" | "actor_email" | "details"
        >;
        Update: NoUpdate;
        Relationships: [];
      };
      policies: {
        Row: PolicyRow;
        Insert: Insertable<
          PolicyRow,
          "id" | "created_at" | "updated_at",
          "description" | "created_by"
        >;
        Update: Partial<Pick<PolicyRow, "title" | "description" | "updated_at">>;
        Relationships: [];
      };
      policy_versions: {
        Row: PolicyVersionRow;
        Insert: Insertable<
          PolicyVersionRow,
          "id" | "created_at",
          "effective_date" | "change_summary" | "created_by"
        >;
        Update: NoUpdate;
        Relationships: [];
      };
      controls: {
        Row: ControlRow;
        Insert: Insertable<
          ControlRow,
          "id" | "revision" | "created_at" | "updated_at",
          | "description"
          | "category"
          | "owner_id"
          | "owner_name"
          | "remediation_status"
          | "remediation_notes"
          | "is_active"
          | "created_by"
        >;
        Update: Partial<
          Pick<
            ControlRow,
            | "control_ref"
            | "title"
            | "description"
            | "category"
            | "owner_id"
            | "owner_name"
            | "remediation_status"
            | "remediation_notes"
            | "is_active"
          >
        >;
        Relationships: [];
      };
      control_evidence: {
        Row: ControlEvidenceRow;
        Insert: Insertable<
          ControlEvidenceRow,
          "id" | "created_at",
          "description" | "evidence_date" | "reference" | "created_by"
        >;
        Update: NoUpdate;
        Relationships: [];
      };
      assessments: {
        Row: AssessmentRow;
        Insert: Insertable<
          AssessmentRow,
          "id" | "created_at" | "updated_at",
          | "assessment_version"
          | "supersedes_id"
          | "status"
          | "is_stale"
          | "stale_reasons"
          | "control_snapshot"
          | "ai_model"
          | "ai_summary"
          | "ai_error"
          | "created_by"
          | "analyzed_at"
          | "completed_at"
        >;
        Update: Partial<
          Pick<
            AssessmentRow,
            | "status"
            | "is_stale"
            | "stale_reasons"
            | "control_snapshot"
            | "ai_model"
            | "ai_summary"
            | "ai_error"
            | "analyzed_at"
            | "completed_at"
          >
        >;
        Relationships: [];
      };
      requirement_changes: {
        Row: RequirementChangeRow;
        Insert: Insertable<
          RequirementChangeRow,
          "id" | "created_at",
          | "old_section_ref"
          | "old_text"
          | "new_section_ref"
          | "new_text"
          | "rationale"
          | "citation_verified"
        >;
        Update: NoUpdate;
        Relationships: [];
      };
      impact_mappings: {
        Row: ImpactMappingRow;
        Insert: Insertable<
          ImpactMappingRow,
          "id" | "created_at" | "updated_at",
          | "evidence_outdated"
          | "evidence_rationale"
          | "suggested_remediation"
          | "review_status"
          | "final_impact_level"
          | "reviewer_id"
          | "reviewed_at"
          | "reviewer_note"
        >;
        Update: Partial<
          Pick<
            ImpactMappingRow,
            | "review_status"
            | "final_impact_level"
            | "reviewer_id"
            | "reviewed_at"
            | "reviewer_note"
          >
        >;
        Relationships: [];
      };
      context_questions: {
        Row: ContextQuestionRow;
        Insert: Insertable<
          ContextQuestionRow,
          "id" | "created_at",
          "why_needed" | "related_control_ids" | "answer" | "answered_by" | "answered_at"
        >;
        Update: Partial<Pick<ContextQuestionRow, "answer" | "answered_by" | "answered_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_policy_version_number: {
        Args: { p_policy_id: string };
        Returns: number;
      };
    };
    Enums: {
      remediation_status: RemediationStatus;
      assessment_status: AssessmentStatus;
      change_type: ChangeType;
      impact_level: ImpactLevel;
      review_status: ReviewStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
