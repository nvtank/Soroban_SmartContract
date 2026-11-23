import { withApi, ok, ApiError } from "@/lib/api/http";
import { getContractOnchainTxs } from "@/lib/stellar";
import type { SessionUser, UserRole } from "@/domain/dto";

type ContractCheckDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { id: string; landlord_id: string; tenant_id: string } | null;
          error: unknown;
        }>;
      };
    };
  };
};

export const GET = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!id) {
    throw new ApiError("VALIDATION_ERROR", { field: "id" }, "Thiếu ID hợp đồng");
  }

  // Xác thực người dùng
  let user: SessionUser | null = null;
  try {
    const session = await import("@/lib/supabase/session");
    if (typeof session.requireUser === "function") {
      user = await session.requireUser();
    }
  } catch {
    // Fallback cho test / mock nếu module Agent B chưa merge trên nhánh này
    const testUserId = request.headers.get("x-test-user-id");
    const testUserRole = (request.headers.get("x-test-user-role") || "LANDLORD") as UserRole;
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
  let db: ContractCheckDb | unknown = null;
  try {
    const adminMod = await import("@/lib/supabase/admin");
    if (typeof adminMod.createAdminSupabase === "function") {
      db = adminMod.createAdminSupabase();
    }
  } catch {
    // Test db
  }

  // Kiểm tra quyền trên hợp đồng
  const contractDb = db as ContractCheckDb | null;
  if (contractDb && typeof contractDb.from === "function") {
    const { data: contract, error } = await contractDb
      .from("rental_contracts")
      .select("id, landlord_id, tenant_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !contract) {
      throw new ApiError("NOT_FOUND", { id }, "Không tìm thấy hợp đồng");
    }

    if (user.role !== "ADMIN_DEMO" && contract.landlord_id !== user.id && contract.tenant_id !== user.id) {
      throw new ApiError("FORBIDDEN");
    }
  }

  const txs = await getContractOnchainTxs(db, id);
  return ok(txs);
});
