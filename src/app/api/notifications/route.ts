import { ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";
import type { NotificationDto } from "@/domain/dto";

export const GET = withApi(async () => {
  const user = await requireUser();
  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const notifications = await repo.notifications.listByUserId(user.id);
  const dtos: NotificationDto[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  return ok(dtos);
});
