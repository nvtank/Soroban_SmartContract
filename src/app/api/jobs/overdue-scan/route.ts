import { z } from "zod";
import { ApiError, ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/session";
import { DEMO_SESSION_COOKIE, verifyDemoSessionToken } from "@/lib/supabase/demo-session";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { scanOverdue } from "@/domain/jobs/overdue-scan";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


const overdueScanSchema = z.object({
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const POST = withApi(async (request: Request) => {
  // Kiểm tra quyền: chỉ chấp nhận CRON_SECRET hoặc phiên ADMIN_DEMO
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const hasValidSecret =
    Boolean(expectedSecret) && (bearerToken === expectedSecret || cronSecretHeader === expectedSecret);

  if (!hasValidSecret) {
    let user = await getOptionalUser();
    if (!user) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`${DEMO_SESSION_COOKIE}=([^;]+)`));
        if (match?.[1]) {
          const claims = verifyDemoSessionToken(match[1]);
          if (claims) {
            user = { id: claims.uid, role: claims.role, fullName: null, phone: null };
          }
        }
      }
    }

    if (user?.role !== "ADMIN_DEMO") {
      throw new ApiError("FORBIDDEN", undefined, "Yêu cầu quyền truy cập cron job hoặc tài khoản ADMIN_DEMO.");
    }
  }

  let body: { asOfDate?: string } | undefined;
  try {
    body = await parseJson(request, overdueScanSchema);
  } catch {
    body = undefined;
  }

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const result = await scanOverdue(repo, body, { enqueueOnchain });
  return ok(result);
});
