import "@tanstack/react-start/server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { requireEnv } from "./env";

let client: SupabaseClient<Database> | undefined;

/** Secret-key client. RLS denies anon access, so every query goes through here. */
export function getSupabase(): SupabaseClient<Database> {
  client ??= createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
