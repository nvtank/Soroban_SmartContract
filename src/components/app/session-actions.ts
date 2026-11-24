"use server";

import { cookies } from "next/headers";
import type { SessionUser } from "@/domain/dto";
import { getOptionalUser } from "@/lib/supabase/session";

export async function getServerSessionUser(): Promise<SessionUser | null> {
  return await getOptionalUser();
}

export async function logoutServerAction(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("rentflow_demo_user_id");
  } catch {
    // Ignore in non-cookie environments
  }
}

export async function switchDemoUserAction(
  userKey: "landlord" | "tenant1" | "tenant2" | "admin",
): Promise<SessionUser | null> {
  if (process.env.DEMO_MODE !== "true") {
    return null;
  }

  const userIds: Record<string, string> = {
    landlord: "00000000-0000-0000-0000-000000000001",
    tenant1: "00000000-0000-0000-0000-000000000002",
    tenant2: "00000000-0000-0000-0000-000000000003",
    admin: "00000000-0000-0000-0000-000000000001",
  };

  const targetId = userIds[userKey];
  if (!targetId) return null;

  try {
    const cookieStore = await cookies();
    cookieStore.set("rentflow_demo_user_id", targetId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  } catch {
    // Ignore
  }

  return await getOptionalUser();
}
