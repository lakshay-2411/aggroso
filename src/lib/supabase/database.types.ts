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
    };
    Views: Record<string, never>;
    Functions: {
      next_policy_version_number: {
        Args: { p_policy_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
