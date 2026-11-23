import { z } from "zod";
import { ApiError, ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/server";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { scanOverdue } from "@/domain/jobs/overdue-scan";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const dynamic = "force-dynamic";

const overdueScanSchema = z
  .object({
    asOfDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .optional();

export const POST = withApi(async (request: Request) => {
  // Kiểm tra quyền: CRON_SECRET hoặc DEMO_MODE với admin
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const hasValidSecret =
    Boolean(expectedSecret) && (bearerToken === expectedSecret || cronSecretHeader === expectedSecret);

  if (!hasValidSecret) {
    // Nếu trong DEMO_MODE, cho phép user đã đăng nhập gọi (để admin-demo chạy tay)
    const isDemoMode = process.env.DEMO_MODE === "true";
    const user = await getOptionalUser();
    if (!isDemoMode || !user) {
      throw new ApiError("FORBIDDEN", undefined, "Yêu cầu quyền truy cập cron job.");
    }
  }

  let body: { asOfDate?: string } | undefined;
  try {
    body = await parseJson(request, overdueScanSchema as any);
  } catch {
    body = undefined;
  }

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const result = await scanOverdue(repo, body, { enqueueOnchain });
  return ok(result);
});
