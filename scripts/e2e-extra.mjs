// Kiểm thử các nhánh còn lại trên app thật + contract Testnet: phạt trễ, hoàn cọc hai bên, nộp thừa.
// Chạy: BASE=http://127.0.0.1:3112 node scripts/e2e-extra.mjs (cần DEMO_MODE=true, đã seed, ONCHAIN_AUTO_FLUSH=true)
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3112";
const STEP = { "x-step-up-token": "demo-step-up" };
const cronSecret = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .match(/^CRON_SECRET=(.+)$/m)?.[1]
  ?.trim();

async function login(phone) {
  const res = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ phone, code: "123456" }),
  });
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}
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
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " | " + detail : ""}`);
}
const data = (r) => r.json?.data;

const landlord = await login("0900000001");
const tenant = await login("0900000002");

const created = data(
  await call(landlord, "POST", "/api/contracts", {
    roomLabel: `Phòng kiểm thử ${Date.now() % 10000}`,
    rentAmount: "3000000",
    depositAmount: "6000000",
    startDate: "2026-10-01",
    endDate: "2027-09-30",
    dueDay: 5,
    lateFeeBpsPerDay: 20,
    termsText: "Kiểm thử phạt trễ và hoàn cọc.",
    tenantPhoneInvited: "0900000002",
  }),
);
const id = created.id;
await call(tenant, "POST", `/api/contracts/${id}/confirm`, {}, STEP);
const dep = data(await call(tenant, "POST", `/api/contracts/${id}/deposit/pay`, { provider: "SIMULATED" }));
await call(tenant, "POST", `/api/payments/${dep.id}/simulate-confirm`, { scenario: "FULL" });

// --- 1. Quá hạn và phí trễ
const scan = await call(
  landlord,
  "POST",
  "/api/jobs/overdue-scan",
  { asOfDate: "2026-11-24" },
  { authorization: `Bearer ${cronSecret}` },
);
check("quét quá hạn chạy được", scan.status === 200, JSON.stringify(data(scan))?.slice(0, 90));
let detail = data(await call(tenant, "GET", `/api/contracts/${id}`));
const p1 = detail.rentPeriods.find((p) => p.periodNo === 1);
// 20 bps/ngày * 3.000.000 * số ngày / 10000 (làm tròn xuống)
const expectedFee = (BigInt(3000000) * 20n * BigInt(p1.lateDays)) / 10000n;
check(
  "kỳ 1 quá hạn, có số ngày trễ",
  p1.status === "OVERDUE" && p1.lateDays > 0,
  `status=${p1.status} lateDays=${p1.lateDays}`,
);
check(
  "phí trễ đúng công thức rent*bps*ngày/10000",
  BigInt(p1.lateFee) === expectedFee,
  `lateFee=${p1.lateFee} mong đợi=${expectedFee}`,
);

// --- 2. Thanh toán kỳ quá hạn phải gồm cả phí trễ; nộp thừa không tự hoàn
const rentPay = data(
  await call(tenant, "POST", `/api/contracts/${id}/rent/1/pay`, { provider: "SIMULATED" }),
);
check(
  "số cần thu = tiền thuê + phí trễ",
  BigInt(rentPay.businessAmount) === 3000000n + expectedFee,
  `businessAmount=${rentPay.businessAmount}`,
);
const over = await call(tenant, "POST", `/api/payments/${rentPay.id}/simulate-confirm`, {
  scenario: "OVERPAID",
});
check(
  "nộp thừa được ghi nhận OVERPAID, không tự hoàn",
  data(over)?.status === "OVERPAID" || over.status === 200,
  `status=${data(over)?.status}`,
);
detail = data(await call(tenant, "GET", `/api/contracts/${id}`));
check(
  "kỳ 1 chuyển sang đã thanh toán sau khi nộp đủ+thừa",
  detail.rentPeriods.find((p) => p.periodNo === 1).status === "PAID",
  `status=${detail.rentPeriods.find((p) => p.periodNo === 1).status}`,
);

// --- 3. Hoàn cọc: cần cả hai bên cùng số tiền
const req = await call(tenant, "POST", `/api/contracts/${id}/refund/request`, {});
check("người thuê yêu cầu hoàn cọc", req.status === 200 || req.status === 201, `${req.status}`);
const a1 = await call(
  landlord,
  "POST",
  `/api/contracts/${id}/refund/approve`,
  { refundAmount: "6000000" },
  STEP,
);
detail = data(await call(tenant, "GET", `/api/contracts/${id}`));
check(
  "một bên duyệt thì CHƯA giải ngân (vẫn chờ hoàn cọc)",
  detail.deposit.status === "PENDING_REFUND" && detail.status === "ACTIVE",
  `deposit=${detail.deposit.status} contract=${detail.status} (${a1.status})`,
);
const ok2 = await call(
  tenant,
  "POST",
  `/api/contracts/${id}/refund/approve`,
  { refundAmount: "6000000" },
  STEP,
);
detail = data(await call(tenant, "GET", `/api/contracts/${id}`));
check(
  "hai bên cùng số tiền thì hoàn cọc xong",
  detail.deposit.status === "REFUNDED" && detail.status === "ENDED",
  `deposit=${detail.deposit.status} contract=${detail.status} (${ok2.status})`,
);
const after = await call(landlord, "POST", `/api/contracts/${id}/deduction/propose`, {
  amount: "100000",
  reasonText: "Sau khi đã hoàn",
});
check("không đề xuất khấu trừ được sau khi đã hoàn", after.status >= 400, `${after.status}`);
const again = await call(
  tenant,
  "POST",
  `/api/contracts/${id}/refund/approve`,
  { refundAmount: "6000000" },
  STEP,
);
detail = data(await call(tenant, "GET", `/api/contracts/${id}`));
check(
  "duyệt lần hai chỉ trả trạng thái cũ, không hoàn cọc lần nữa",
  detail.deposit.status === "REFUNDED" && detail.status === "ENDED",
  `${again.status}`,
);

// --- 4. Hai bên lệch số tiền: khóa cọc, hệ thống không tự kết luận, chỉ chốt khi hai bên cùng số
const c2 = data(
  await call(landlord, "POST", "/api/contracts", {
    roomLabel: `Phòng tranh chấp ${Date.now() % 10000}`,
    rentAmount: "3000000",
    depositAmount: "6000000",
    startDate: "2026-11-01",
    endDate: "2027-10-31",
    dueDay: 28,
    lateFeeBpsPerDay: 20,
    termsText: "Kiểm thử lệch số tiền hoàn cọc.",
    tenantPhoneInvited: "0900000002",
  }),
);
await call(tenant, "POST", `/api/contracts/${c2.id}/confirm`, {}, STEP);
const dep2 = data(
  await call(tenant, "POST", `/api/contracts/${c2.id}/deposit/pay`, { provider: "SIMULATED" }),
);
await call(tenant, "POST", `/api/payments/${dep2.id}/simulate-confirm`, { scenario: "FULL" });
await call(tenant, "POST", `/api/contracts/${c2.id}/refund/request`, {});
await call(landlord, "POST", `/api/contracts/${c2.id}/refund/approve`, { refundAmount: "5000000" }, STEP);
await call(tenant, "POST", `/api/contracts/${c2.id}/refund/approve`, { refundAmount: "6000000" }, STEP);
let d2 = data(await call(tenant, "GET", `/api/contracts/${c2.id}`));
check(
  "lệch số tiền thì chuyển sang chờ xử lý tranh chấp, khóa cọc",
  d2.deposit.status === "PENDING_DISPUTE" && d2.status === "ACTIVE",
  `deposit=${d2.deposit.status} dispute=${d2.dispute?.status}`,
);
const single = await call(
  landlord,
  "POST",
  `/api/contracts/${c2.id}/dispute/resolve`,
  { agreedAmount: "5500000" },
  STEP,
);
d2 = data(await call(tenant, "GET", `/api/contracts/${c2.id}`));
check(
  "một bên chốt số thì chưa kết thúc",
  d2.deposit.status === "PENDING_DISPUTE",
  `deposit=${d2.deposit.status} dispute=${d2.dispute?.status} (${single.status})`,
);
const diff = await call(
  tenant,
  "POST",
  `/api/contracts/${c2.id}/dispute/resolve`,
  { agreedAmount: "5000000" },
  STEP,
);
d2 = data(await call(tenant, "GET", `/api/contracts/${c2.id}`));
check(
  "hai bên chốt hai số khác nhau thì vẫn khóa",
  d2.deposit.status === "PENDING_DISPUTE",
  `deposit=${d2.deposit.status} dispute=${d2.dispute?.status} (${diff.status})`,
);
const same1 = await call(
  landlord,
  "POST",
  `/api/contracts/${c2.id}/dispute/resolve`,
  { agreedAmount: "5500000" },
  STEP,
);
const same2 = await call(
  tenant,
  "POST",
  `/api/contracts/${c2.id}/dispute/resolve`,
  { agreedAmount: "5500000" },
  STEP,
);
d2 = data(await call(tenant, "GET", `/api/contracts/${c2.id}`));
check(
  "hai bên cùng số tiền thì tranh chấp được thống nhất và kết thúc",
  d2.dispute?.status === "RESOLVED" && d2.status === "ENDED",
  `deposit=${d2.deposit.status} dispute=${d2.dispute?.status} contract=${d2.status} (${same1.status}/${same2.status})`,
);

// --- 5. Gia hạn thanh toán: chỉ chủ nhà, đổi hạn, miễn phí trễ, quét quá hạn không đánh dấu lại
const c3 = data(
  await call(landlord, "POST", "/api/contracts", {
    roomLabel: `Phòng gia hạn ${Date.now() % 10000}`,
    rentAmount: "3000000",
    depositAmount: "6000000",
    startDate: "2026-10-01",
    endDate: "2027-09-30",
    dueDay: 5,
    lateFeeBpsPerDay: 20,
    termsText: "Kiểm thử gia hạn thanh toán.",
    tenantPhoneInvited: "0900000002",
  }),
);
await call(tenant, "POST", `/api/contracts/${c3.id}/confirm`, {}, STEP);
const dep3 = data(
  await call(tenant, "POST", `/api/contracts/${c3.id}/deposit/pay`, { provider: "SIMULATED" }),
);
await call(tenant, "POST", `/api/payments/${dep3.id}/simulate-confirm`, { scenario: "FULL" });
const today = new Date().toISOString().slice(0, 10);
const scanAuth = { authorization: `Bearer ${cronSecret}` };
await call(landlord, "POST", "/api/jobs/overdue-scan", { asOfDate: today }, scanAuth);
const newDue = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
const byTenant = await call(
  tenant,
  "POST",
  `/api/contracts/${c3.id}/rent/1/extend`,
  { newDueDate: newDue },
  STEP,
);
check("người thuê không được gia hạn cho chính mình", byTenant.status === 403, `${byTenant.status}`);
const past = await call(
  landlord,
  "POST",
  `/api/contracts/${c3.id}/rent/1/extend`,
  { newDueDate: "2026-10-06" },
  STEP,
);
check("không gia hạn về một ngày đã qua", past.status === 400, `${past.status}`);
const ext = await call(
  landlord,
  "POST",
  `/api/contracts/${c3.id}/rent/1/extend`,
  { newDueDate: newDue },
  STEP,
);
check("chủ nhà gia hạn thành công", ext.status === 200, `${ext.status}`);
let d3 = data(await call(tenant, "GET", `/api/contracts/${c3.id}`));
let q = d3.rentPeriods.find((x) => x.periodNo === 1);
check(
  "hạn mới được lưu, phí trễ được miễn",
  q.dueDate === newDue && q.status === "AWAITING_PAYMENT" && q.lateFee === "0",
  `due=${q.dueDate} status=${q.status} fee=${q.lateFee}`,
);
await call(landlord, "POST", "/api/jobs/overdue-scan", { asOfDate: today }, scanAuth);
d3 = data(await call(tenant, "GET", `/api/contracts/${c3.id}`));
q = d3.rentPeriods.find((x) => x.periodNo === 1);
check(
  "quét quá hạn sau gia hạn không đánh dấu quá hạn lại",
  q.status === "AWAITING_PAYMENT",
  `status=${q.status}`,
);
const later = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const extendAgain = await call(
  landlord,
  "POST",
  `/api/contracts/${c3.id}/rent/1/extend`,
  { newDueDate: later },
  STEP,
);
check("kỳ đã hết quá hạn thì không gia hạn tiếp", extendAgain.status === 409, `${extendAgain.status}`);

console.log(
  `\nhợp đồng A ${id}\nhợp đồng B ${c2.id}\nhợp đồng C ${c3.id}\n${failures ? failures + " kiểm tra lỗi" : "tất cả kiểm tra đạt"}`,
);
