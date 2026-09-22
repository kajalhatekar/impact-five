import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Creates a server-only Supabase admin client.
 *
 * This uses the secret service key and must only be imported from trusted
 * server code such as admin pages or route handlers that perform authorization.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is missing.");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}