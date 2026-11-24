import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  let dbStatus = "ok";
  try {
    const admin = createAdminSupabase();
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (error) {
      dbStatus = "error";
    }
  } catch {
    dbStatus = "unreachable";
  }

  return NextResponse.json({
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      demoMode: process.env.DEMO_MODE === "true",
    },
  });
}
