import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Privileged client that bypasses row-level security.
 * Server-only. Used exclusively for append-only writes such as the audit log,
 * so that ordinary user sessions can never modify history.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.supabaseSecretKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
