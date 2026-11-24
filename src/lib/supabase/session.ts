import { cookies, headers } from "next/headers";
import type { SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { createServerSupabase } from "./server";
import { createAdminSupabase } from "./admin";

export async function getOptionalUser(): Promise<SessionUser | null> {
  const admin = createAdminSupabase();

  // 1. Check standard Supabase session
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, role, full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          role: profile.role,
          fullName: profile.full_name,
          phone: profile.phone,
        };
      }

      return {
        id: user.id,
        role: "TENANT",
        fullName: user.user_metadata?.full_name ?? null,
        phone: user.phone ?? null,
      };
    }
  } catch {
    // Proceed to check fallback/demo headers
  }

  // 2. Demo mode session support
  if (process.env.DEMO_MODE === "true") {
    try {
      const cookieStore = await cookies();
      const demoUserId = cookieStore.get("rentflow_demo_user_id")?.value;
      if (demoUserId) {
        const { data: profile } = await admin
          .from("profiles")
          .select("id, role, full_name, phone")
          .eq("id", demoUserId)
          .maybeSingle();

        if (profile) {
          return {
            id: profile.id,
            role: profile.role,
            fullName: profile.full_name,
            phone: profile.phone,
          };
        }
      }

      // Check header in server context / testing
      const headerStore = await headers();
      const demoHeaderId = headerStore.get("x-demo-user-id");
      if (demoHeaderId) {
        const { data: profile } = await admin
          .from("profiles")
          .select("id, role, full_name, phone")
          .eq("id", demoHeaderId)
          .maybeSingle();

        if (profile) {
          return {
            id: profile.id,
            role: profile.role,
            fullName: profile.full_name,
            phone: profile.phone,
          };
        }
      }
    } catch {
      // Ignored
    }
  }

  return null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) {
    throw new ApiError("UNAUTHENTICATED");
  }
  return user;
}
