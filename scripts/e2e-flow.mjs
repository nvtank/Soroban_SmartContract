// Đi hết luồng nghiệp vụ trên app thật (không mock) bằng API. Chạy: BASE=http://127.0.0.1:3112 node scripts/e2e-flow.mjs (cần DEMO_MODE=true và đã gọi /api/demo/seed).
const BASE = process.env.BASE || "http://127.0.0.1:3112";
const STEP = { "x-step-up-token": "demo-step-up" };

async function login(phone) {
  const res = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ phone, code: "123456" }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!res.ok || !cookie.includes("rentflow_session")) throw new Error(`login ${phone} failed ${res.status}`);
  return cookie;
}

const show = (v, n = 150) => JSON.stringify(v)?.slice(0, n);
async function call(who, method, path, body, extra = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, cookie: who, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* không phải JSON */
  }
  return { status: res.status, json };
}
let failures = 0;
function step(name, r, okStatuses = [200, 201]) {
  const ok = okStatuses.includes(r.status);
  if (!ok) failures++;
  const detail = r.json?.error ? `${r.json.error.code}: ${r.json.error.message}` : show(r.json?.data);
  console.log(`${ok ? "ok  " : "FAIL"} ${r.status} ${name} ${ok ? "" : "-> " + detail}`);
  return r.json?.data;
}

const landlord = await login("0900000001");
const tenant = await login("0900000002");

const created = step(
  "landlord tạo hợp đồng",
  await call(landlord, "POST", "/api/contracts", {
    roomLabel: `Phòng test ${Date.now() % 10000}`,
    rentAmount: "3000000",
    depositAmount: "6000000",
    startDate: "2026-10-01",
    endDate: "2027-09-30",
    dueDay: 5,
    lateFeeBpsPerDay: 20,
    termsText: "Điều khoản thử nghiệm luồng đầu-cuối.",
    tenantPhoneInvited: "0900000002",
  }),
);
const id = created?.id;
if (!id) {
  console.log("không có id hợp đồng, dừng");
  process.exit(1);
}
console.log("   contract", id.slice(0, 8), "docHash", created.docHash ? "có" : "chưa");

step("tenant xác nhận (step-up demo)", await call(tenant, "POST", `/api/contracts/${id}/confirm`, {}, STEP));
let d = step("tenant xem hợp đồng", await call(tenant, "GET", `/api/contracts/${id}`));
console.log("   status", d?.status, "| deposit", d?.deposit?.status);

const pay1 = step(
  "tạo thanh toán cọc",
  await call(tenant, "POST", `/api/contracts/${id}/deposit/pay`, { provider: "SIMULATED" }),
);
step(
  "giả lập nộp THIẾU",
  await call(tenant, "POST", `/api/payments/${pay1?.id}/simulate-confirm`, { scenario: "UNDERPAID" }),
);
d = (await call(tenant, "GET", `/api/contracts/${id}`)).json?.data;
console.log("   sau nộp thiếu: deposit", d?.deposit?.status, "(mong đợi UNPAID)");

const pay2 = step(
  "tạo lại thanh toán cọc",
  await call(tenant, "POST", `/api/contracts/${id}/deposit/pay`, { provider: "SIMULATED" }),
);
step(
  "giả lập nộp ĐỦ",
  await call(tenant, "POST", `/api/payments/${pay2?.id}/simulate-confirm`, { scenario: "FULL" }),
);
d = (await call(tenant, "GET", `/api/contracts/${id}`)).json?.data;
console.log(
  "   sau nộp đủ: deposit",
  d?.deposit?.status,
  "(mong đợi RECORDED) | kỳ thuê",
  d?.rentPeriods?.length,
);

const period = d?.rentPeriods?.[0]?.periodNo ?? 1;
const rent = step(
  `tạo thanh toán tiền thuê kỳ ${period}`,
  await call(tenant, "POST", `/api/contracts/${id}/rent/${period}/pay`, { provider: "SIMULATED" }),
);
step(
  "giả lập trả đủ tiền thuê",
  await call(tenant, "POST", `/api/payments/${rent?.id}/simulate-confirm`, { scenario: "FULL" }),
);

step(
  "landlord đề xuất khấu trừ",
  await call(landlord, "POST", `/api/contracts/${id}/deduction/propose`, {
    amount: "500000",
    reasonText: "Hư hỏng nhỏ khi bàn giao.",
  }),
);
d = (await call(tenant, "GET", `/api/contracts/${id}`)).json?.data;
const ded = d?.deductions?.[0];
step(
  "tenant TỪ CHỐI khấu trừ",
  await call(tenant, "POST", `/api/deductions/${ded?.id}/respond`, { accept: false }, STEP),
);
d = (await call(tenant, "GET", `/api/contracts/${id}`)).json?.data;
console.log(
  "   sau từ chối: deposit",
  d?.deposit?.status,
  "| dispute",
  d?.dispute?.status,
  "(mong đợi PENDING_DISPUTE / IN_PROGRESS)",
);
step(
  "tenant cố hoàn cọc khi đang tranh chấp (phải bị chặn)",
  await call(tenant, "POST", `/api/contracts/${id}/refund/approve`, { refundAmount: "6000000" }, STEP),
  [400, 403, 409],
);

const chain = step(
  "danh sách giao dịch on-chain",
  await call(landlord, "GET", `/api/contracts/${id}/onchain`),
);
for (const t of chain ?? [])
  console.log(
    `   onchain ${t.action} | ${t.status} | tx=${t.txHash ? "có" : "không"} | ${(t.error ?? "").slice(0, 60)}`,
  );
console.log(failures ? `\n${failures} bước lỗi` : "\ntất cả bước đạt");
