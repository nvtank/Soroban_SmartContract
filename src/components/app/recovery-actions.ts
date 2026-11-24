"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PendingRecovery } from "./mock/mock-service";

export async function getPendingRecoveriesAction(): Promise<PendingRecovery[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("recovery_requests")
    .select("id, phone, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    phone: item.phone,
    status: item.status as "PENDING" | "APPROVED",
    createdAt: item.created_at,
  }));
}

export async function approveRecoveryAction(id: string): Promise<void> {
  const admin = createAdminSupabase();
  await admin
    .from("recovery_requests")
    .update({ status: "APPROVED" })
    .eq("id", id);
}
