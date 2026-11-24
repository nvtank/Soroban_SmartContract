import { withApi, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { prepareDemoScenario } from "@/lib/demo/scenario";

// Chuẩn bị kịch bản trình diễn bằng API nghiệp vụ thật (3 hợp đồng, ghi lên Testnet qua hàng đợi on-chain).
export const POST = withApi(async (request: Request) => {
  if (process.env.DEMO_MODE !== "true") {
    throw new ApiError("NOT_FOUND");
  }
  const origin = new URL(request.url).origin;
  try {
    const result = await prepareDemoScenario(createAdminSupabase(), origin);
    return ok({ prepared: true, isDemo: true, contracts: result.contracts });
  } catch (error) {
    // Chỉ log thông điệp lỗi nghiệp vụ của kịch bản demo (không chứa secret hay dữ liệu cá nhân)
    console.error("[demo/prepare]", error instanceof Error ? error.message : String(error));
    throw error;
  }
});
