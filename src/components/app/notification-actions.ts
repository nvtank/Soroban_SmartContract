"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/session";
import type { NotificationDto } from "@/domain/dto";

export async function getNotificationsAction(): Promise<NotificationDto[]> {
  const user = await getOptionalUser();
  if (!user) return [];

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data.map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await getOptionalUser();
  if (!user) return;

  const admin = createAdminSupabase();
  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
}
