import { cookies } from "next/headers";
import { ApiError } from "@/lib/api/http";
import { DEMO_SESSION_COOKIE, verifyDemoSessionToken } from "@/lib/supabase/demo-session";
import { requireUser } from "@/lib/supabase/session";

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN_DEMO") throw new ApiError("FORBIDDEN");

  const store = await cookies();
  const signed = verifyDemoSessionToken(store.get(DEMO_SESSION_COOKIE)?.value);
  if (signed?.uid !== user.id || signed.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN");
  }
  return user;
}
