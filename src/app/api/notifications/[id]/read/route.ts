import { ApiError, ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const POST = withApi(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const success = await repo.notifications.markAsRead(id, user.id);
  if (!success) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy thông báo hoặc bạn không có quyền.");
  }

  return ok({ success: true, id });
});
