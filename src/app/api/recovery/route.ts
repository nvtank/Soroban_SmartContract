import { withApi, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const GET = withApi(async () => {
  const admin = createAdminSupabase();

  const { data: rows } = await admin
    .from("recovery_requests")
    .select("id, phone, status, created_at, note, user_id")
    .order("created_at", { ascending: false });

  const recoveries = (rows || []).map((r) => ({
    id: r.id,
    phone: r.phone || "",
    status: r.status as "PENDING" | "APPROVED" | "REJECTED",
    createdAt: r.created_at,
    note: r.note,
    userId: r.user_id,
  }));

  return ok(recoveries);
});
