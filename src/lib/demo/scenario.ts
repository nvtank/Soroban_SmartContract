import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_USERS } from "@/lib/supabase/demo-accounts";
import { createSessionToken } from "@/lib/supabase/demo-session";
import { seedDemoUsers, wipeDemoData } from "@/lib/supabase/seed";

/**
 * Chuẩn bị kịch bản trình diễn bằng CHÍNH các API nghiệp vụ thật (không chèn thẳng vào database),
 * để hợp đồng mẫu có mã băm thật, thanh toán mô phỏng thật và được ghi lên Stellar Testnet qua hàng đợi on-chain.
 * Chỉ dùng khi DEMO_MODE=true.
 */

type Actor = { id: string; role: "LANDLORD" | "TENANT" | "ADMIN_DEMO" };
type Json = Record<string, unknown>;

const STEP_UP = { "x-step-up-token": "demo-step-up" };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type DemoScenarioResult = {
  contracts: { label: string; id: string; story: string }[];
};

export async function prepareDemoScenario(
  admin: SupabaseClient,
  origin: string,
): Promise<DemoScenarioResult> {
  await wipeDemoData(admin);
  await seedDemoUsers(admin);

  const cookieFor = (actor: Actor) => {
    const token = createSessionToken(actor.id, actor.role);
    if (!token) throw new Error("Thiếu SESSION_SECRET để chuẩn bị kịch bản demo.");
    return `rentflow_session=${token}`;
  };
  const landlord = cookieFor(DEMO_USERS.LANDLORD);
  const tenant1 = cookieFor(DEMO_USERS.TENANT_1);
  const tenant2 = cookieFor(DEMO_USERS.TENANT_2);

  async function call<T = Json>(
    cookie: string,
    method: string,
    path: string,
    body?: Json,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { "content-type": "application/json", origin, cookie, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as {
      data?: T;
      error?: { code: string; message: string };
    } | null;
    if (!response.ok || !json?.data) {
      throw new Error(`Bước ${method} ${path} lỗi ${response.status}: ${json?.error?.message ?? "không rõ"}`);
    }
    return json.data;
  }

  // Kỳ 1 luôn nằm trong quá khứ (đầu tháng trước, ngày thanh toán mùng 5) nên quét quá hạn luôn có kết quả.
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), 0));
  const terms =
    "Điều khoản mẫu phục vụ trình diễn. Tiền cọc và thanh toán là mô phỏng, không có giá trị tiền thật.";
  const base = {
    startDate: isoDate(start),
    endDate: isoDate(end),
    dueDay: 5,
    lateFeeBpsPerDay: 20,
    termsText: terms,
  };

  async function createContract(roomLabel: string, rent: string, deposit: string, tenantPhone: string) {
    return call<{ id: string }>(landlord, "POST", "/api/contracts", {
      ...base,
      roomLabel,
      rentAmount: rent,
      depositAmount: deposit,
      tenantPhoneInvited: tenantPhone,
    });
  }
  async function payDeposit(tenant: string, contractId: string) {
    const payment = await call<{ id: string }>(tenant, "POST", `/api/contracts/${contractId}/deposit/pay`, {
      provider: "SIMULATED",
    });
    await call(tenant, "POST", `/api/payments/${payment.id}/simulate-confirm`, { scenario: "FULL" });
  }

  const result: DemoScenarioResult = { contracts: [] };

  // A. Chờ người thuê xác nhận (để diễn bước 1 trực tiếp)
  const a = await createContract("Phòng 301 - Tòa Sunrise", "4500000", "9000000", DEMO_USERS.TENANT_1.phone);
  result.contracts.push({
    label: "Phòng 301 - Tòa Sunrise",
    id: a.id,
    story: "Chờ người thuê xác nhận (bước 1)",
  });

  // B. Đang hiệu lực, đã nạp cọc, kỳ 1 quá hạn có phí trễ (bước 2 và 3)
  const b = await createContract(
    "Phòng 402 - Căn hộ Moonlight",
    "3000000",
    "6000000",
    DEMO_USERS.TENANT_1.phone,
  );
  await call(tenant1, "POST", `/api/contracts/${b.id}/confirm`, {}, STEP_UP);
  await payDeposit(tenant1, b.id);
  await call(landlord, "POST", "/api/jobs/overdue-scan", { asOfDate: isoDate(today) });
  result.contracts.push({
    label: "Phòng 402 - Căn hộ Moonlight",
    id: b.id,
    story: "Đang hiệu lực, kỳ 1 quá hạn có phí trễ (bước 2, 3)",
  });

  // C. Người thuê từ chối khấu trừ nên cọc bị khóa chờ xử lý tranh chấp (bước 4 và 5)
  const c = await createContract(
    "Phòng 102 - Nhà phố Green",
    "2500000",
    "5000000",
    DEMO_USERS.TENANT_2.phone,
  );
  await call(tenant2, "POST", `/api/contracts/${c.id}/confirm`, {}, STEP_UP);
  await payDeposit(tenant2, c.id);
  await call(landlord, "POST", `/api/contracts/${c.id}/deduction/propose`, {
    amount: "800000",
    reasonText: "Sơn lại tường phòng khách và giặt rèm cửa bị hư hại khi trả phòng.",
  });
  const detail = await call<{ deductions: { id: string }[] }>(tenant2, "GET", `/api/contracts/${c.id}`);
  await call(
    tenant2,
    "POST",
    `/api/deductions/${detail.deductions[0].id}/respond`,
    { accept: false },
    STEP_UP,
  );
  result.contracts.push({
    label: "Phòng 102 - Nhà phố Green",
    id: c.id,
    story: "Từ chối khấu trừ, cọc khóa chờ tranh chấp (bước 4, 5)",
  });

  return result;
}
