"use server";

import type { SessionUser } from "@/domain/dto";
import { getOptionalUser } from "@/lib/supabase/session";
import { DEMO_USERS } from "@/lib/supabase/demo-accounts";
import { clearDemoSessionCookie, setDemoSessionCookie } from "@/lib/supabase/demo-session-cookie";

export async function getServerSessionUser(): Promise<SessionUser | null> {
  return await getOptionalUser();
}

export async function logoutServerAction(): Promise<void> {
  await clearDemoSessionCookie();
}

export async function switchDemoUserAction(
  userKey: "landlord" | "tenant1" | "tenant2" | "admin",
): Promise<SessionUser | null> {
  if (process.env.DEMO_MODE !== "true") {
    return null;
  }

  // Ánh xạ tới tài khoản demo do seed tạo; admin trỏ tới ADMIN_DEMO thật.
  const accounts = {
    landlord: DEMO_USERS.LANDLORD,
    tenant1: DEMO_USERS.TENANT_1,
    tenant2: DEMO_USERS.TENANT_2,
    admin: DEMO_USERS.ADMIN,
  } as const;

  const target = accounts[userKey];
  if (!target) return null;

  const issued = await setDemoSessionCookie(target.id);
  if (!issued) return null;

  return await getOptionalUser();
}
