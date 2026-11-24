import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const isDemo = process.env.DEMO_MODE === "true";
  const paymentMode = process.env.PAYMENT_MODE || "both";

  // 1. Kiểm tra Database
  let dbStatus: "ok" | "error" | "unreachable" = "ok";
  try {
    const admin = createAdminSupabase();
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (error) {
      dbStatus = "error";
    }
  } catch {
    dbStatus = "unreachable";
  }

  // 2. Kiểm tra Stellar RPC (Soroban RPC)
  let stellarRpcStatus: "ok" | "unreachable" = "unreachable";
  const rpcUrl = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && !json.error) {
        stellarRpcStatus = "ok";
      } else if (res.status === 200) {
        stellarRpcStatus = "ok";
      }
    }
  } catch {
    stellarRpcStatus = "unreachable";
  }

  // 3. Kiểm tra payOS theo cấu hình (không lộ key hay chi tiết nội bộ)
  const hasPayosCredentials = Boolean(
    process.env.PAYOS_CLIENT_ID &&
    process.env.PAYOS_API_KEY &&
    process.env.PAYOS_CHECKSUM_KEY,
  );

  let payosStatus: "configured" | "simulated" | "simulated_fallback" | "unconfigured" = "configured";
  if (paymentMode === "simulated") {
    payosStatus = "simulated";
  } else if (hasPayosCredentials) {
    payosStatus = "configured";
  } else if (paymentMode === "both") {
    payosStatus = "simulated_fallback";
  } else {
    payosStatus = "unconfigured";
  }

  const isHealthy = dbStatus === "ok";
  const overallStatus = isHealthy ? "ok" : "degraded";
  const httpStatus = isHealthy ? 200 : 503;

  // Trả về kết quả sạch, tuyệt đối không lộ secret, stack trace hay chi tiết nội bộ
  return NextResponse.json(
    {
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        demoMode: isDemo,
        database: dbStatus,
        stellarRpc: stellarRpcStatus,
        payos: payosStatus,
        services: {
          database: dbStatus,
          stellarRpc: stellarRpcStatus,
          payos: payosStatus,
        },
      },
    },
    { status: httpStatus },
  );
}
