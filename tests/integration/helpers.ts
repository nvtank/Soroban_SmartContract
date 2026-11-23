import "@/../tests/setup";
import "@/../tests/safety";
import { assertLocalDatabaseOnly } from "@/../tests/safety";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
export const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export function createTestAdminClient(): SupabaseClient {
  assertLocalDatabaseOnly(SUPABASE_URL);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createTestAnonClient(): SupabaseClient {
  assertLocalDatabaseOnly(SUPABASE_URL);
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function createTestUserSessionClient(
  email: string,
  password = "test-password-123",
): Promise<SupabaseClient> {
  assertLocalDatabaseOnly(SUPABASE_URL);
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user ${email}: ${error.message}`);
  }

  return client;
}
