import { createAdminSupabase } from "@/lib/supabase/admin";

const minute = 60_000;
const lastTouch = new Map<string, number>();

export async function touchActivity(userId: string): Promise<void> {
  const now = Date.now();
  const previous = lastTouch.get(userId);
  if (previous !== undefined && now - previous < minute) return;
  for (const [id, at] of lastTouch) {
    if (now - at < minute) break;
    lastTouch.delete(id);
  }
  lastTouch.delete(userId);
  lastTouch.set(userId, now);
  try {
    const { error } = await createAdminSupabase().rpc("record_admin_activity", { profile_id: userId });
    if (error) throw error;
  } catch {
    if (lastTouch.get(userId) === now) lastTouch.delete(userId);
    console.warn("[activity] unable to update activity");
  }
}

export async function auditSession(userId: string, action: "LOGIN" | "LOGOUT"): Promise<void> {
  try {
    const { error } = await createAdminSupabase().from("audit_logs").insert({
      actor_id: userId,
      action,
      entity: "profiles",
      entity_id: userId,
    });
    if (error) throw error;
  } catch {
    console.warn("[activity] unable to record session event");
  }
  if (action === "LOGIN") await touchActivity(userId);
}
