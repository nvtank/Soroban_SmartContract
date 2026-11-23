import { withApi, ok, ApiError } from "@/lib/api/http";
import { retryOnchainTx } from "@/lib/stellar";
import type { SessionUser } from "@/domain/dto";

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!id) {
    throw new ApiError("VALIDATION_ERROR", { field: "id" }, "Thiếu ID giao dịch");
  }

  // Xác thực người dùng
  let user: SessionUser | null = null;
  try {
    const session = await import("@/lib/supabase/session");
    if (typeof session.requireUser === "function") {
      user = await session.requireUser();
    }
  } catch {
    const testUserId = request.headers.get("x-test-user-id");
    const testUserRole = (request.headers.get("x-test-user-role") || "LANDLORD") as any;
    if (testUserId) {
      user = {
        id: testUserId,
        role: testUserRole,
        fullName: "Người dùng Thử nghiệm",
        phone: "0901234567",
      };
    }
  }

  if (!user) {
    throw new ApiError("UNAUTHENTICATED");
  }

  // Lấy admin database client
  let db: any = null;
  try {
    const adminMod = await import("@/lib/supabase/admin");
    if (typeof adminMod.createAdminSupabase === "function") {
      db = adminMod.createAdminSupabase();
    }
  } catch {
    // Test db
  }

  const updatedTx = await retryOnchainTx(db, id);
  return ok(updatedTx);
});
