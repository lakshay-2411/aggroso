import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Supabase client for use in client components. */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
  );
}
