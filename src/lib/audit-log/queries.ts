import "server-only";
import type { AuditEntityType } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { AuditLogRow } from "@/lib/supabase/database.types";

export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilters {
  entityType?: AuditEntityType;
  action?: string;
  actor?: string;
  page?: number;
}

export interface AuditPage {
  entries: AuditLogRow[];
  total: number;
  page: number;
  pageCount: number;
}

export async function listAuditEntries(filters: AuditFilters): Promise<AuditPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * AUDIT_PAGE_SIZE;

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);

  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.actor) query = query.ilike("actor_email", `%${filters.actor}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load audit log: ${error.message}`);
  const total = count ?? 0;
  return {
    entries: data ?? [],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}

/**
 * History for one record: entries about the record itself plus entries about
 * children that reference it in their details (mappings, actions, questions
 * reference their assessment; evidence references its control).
 */
export async function listEntityHistory(
  entityId: string,
  parentKey: "assessment_id" | "control_id" | "policy_id",
  limit = 200,
): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .or(`entity_id.eq.${entityId},details->>${parentKey}.eq.${entityId}`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load history: ${error.message}`);
  return data ?? [];
}
