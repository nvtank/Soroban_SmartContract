// scripts/chain-stress.mjs
// Kiểm thử đồng thời 5 hợp đồng qua API trên Stellar Testnet (Agent D vòng 4)
// Chạy: BASE=http://127.0.0.1:3116 node scripts/chain-stress.mjs

const BASE = process.env.BASE || "http://127.0.0.1:3116";
const STEP_UP_HEADERS = { "x-step-up-token": "demo-step-up" };
const CONTRACT_COUNT = 5;

function parseCookies(res) {
  if (typeof res.headers.getSetCookie === "function") {
    const raw = res.headers.getSetCookie();
    if (raw && raw.length > 0) {
      return raw.map((c) => c.split(";")[0]).join("; ");
    }
  }
  const rawHeader = res.headers.get("set-cookie");
  if (rawHeader) {
    return rawHeader.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  }
  return "";
}

async function login(phone) {
  console.log(`[stress] Đăng nhập OTP phone ${phone}...`);
  const res = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ phone, code: "123456" }),
  });
  const cookie = parseCookies(res);
  if (!res.ok || !cookie.includes("rentflow_session")) {
    const body = await res.text().catch(() => "");
    throw new Error(`Đăng nhập ${phone} thất bại: HTTP ${res.status} - ${body}`);
  }
  return cookie;
}

async function api(who, method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie: who,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // không phải JSON
  }
  return { status: res.status, ok: res.ok, json };
}

async function runSingleContract(index, landlordCookie, tenantCookie, runId) {
  const roomLabel = `Phòng Stress D R4 - ${runId} - ${index + 1}`;
  console.log(`[stress][#${index + 1}] Bắt đầu tạo hợp đồng: "${roomLabel}"`);

  // 1. Chủ nhà tạo hợp đồng
  const createRes = await api(landlordCookie, "POST", "/api/contracts", {
    roomLabel,
    rentAmount: "3500000",
    depositAmount: "7000000",
    startDate: "2026-12-01",
    endDate: "2027-11-30",
    dueDay: 5,
    lateFeeBpsPerDay: 20,
    termsText: `Điều khoản thử nghiệm đồng thời Agent D vòng 4 (#${index + 1}).`,
    tenantPhoneInvited: "0900000002",
  });

  if (!createRes.ok || !createRes.json?.data?.id) {
    throw new Error(
      `[#${index + 1}] Tạo hợp đồng thất bại: HTTP ${createRes.status} - ${JSON.stringify(createRes.json?.error || createRes.json)}`,
    );
  }
  const contractId = createRes.json.data.id;
  console.log(`[stress][#${index + 1}] Đã tạo hợp đồng: ${contractId}`);

  // 2. Người thuê xác nhận hợp đồng (yêu cầu step-up token)
  const confirmRes = await api(
    tenantCookie,
    "POST",
    `/api/contracts/${contractId}/confirm`,
    {},
    STEP_UP_HEADERS,
  );
  if (!confirmRes.ok) {
    throw new Error(
      `[#${index + 1}] Tenant xác nhận thất bại: HTTP ${confirmRes.status} - ${JSON.stringify(confirmRes.json?.error || confirmRes.json)}`,
    );
  }
  console.log(`[stress][#${index + 1}] Tenant đã xác nhận hợp đồng ${contractId}`);

  // 3. Người thuê tạo thanh toán tiền cọc mô phỏng
  const depositPayRes = await api(
    tenantCookie,
    "POST",
    `/api/contracts/${contractId}/deposit/pay`,
    { provider: "SIMULATED" },
  );
  if (!depositPayRes.ok || !depositPayRes.json?.data?.id) {
    throw new Error(
      `[#${index + 1}] Tạo thanh toán cọc thất bại: HTTP ${depositPayRes.status} - ${JSON.stringify(depositPayRes.json?.error || depositPayRes.json)}`,
    );
  }
  const paymentId = depositPayRes.json.data.id;
  console.log(`[stress][#${index + 1}] Đã tạo thanh toán cọc: ${paymentId}`);

  // 4. Mô phỏng nộp đủ tiền cọc
  const simulateRes = await api(
    tenantCookie,
    "POST",
    `/api/payments/${paymentId}/simulate-confirm`,
    { scenario: "FULL" },
  );
  if (!simulateRes.ok) {
    throw new Error(
      `[#${index + 1}] Giả lập thanh toán cọc thất bại: HTTP ${simulateRes.status} - ${JSON.stringify(simulateRes.json?.error || simulateRes.json)}`,
    );
  }
  console.log(`[stress][#${index + 1}] Đã nộp cọc mô phỏng FULL cho hợp đồng ${contractId}`);

  return {
    index: index + 1,
    contractId,
    roomLabel,
  };
}

async function main() {
  console.log("===============================================================");
  console.log("   RENTFLOW AGENT D - KIỂM THỬ ĐỒNG THỜI TRÊN TESTNET");
  console.log(`   Target Server: ${BASE}`);
  console.log(`   Số hợp đồng đồng thời: ${CONTRACT_COUNT}`);
  console.log("===============================================================");

  const startTime = Date.now();
  const runId = Math.floor(startTime / 1000) % 100000;

  // 1. Đăng nhập 2 tài khoản demo
  const landlordCookie = await login("0900000001");
  const tenantCookie = await login("0900000002");
  console.log("[stress] Đăng nhập thành công cả chủ nhà và người thuê.");

  // 2. Tạo song song 5 hợp đồng
  console.log(`\n[stress] Đang tạo đồng thời ${CONTRACT_COUNT} hợp đồng qua API...`);
  const contractPromises = Array.from({ length: CONTRACT_COUNT }, (_, i) =>
    runSingleContract(i, landlordCookie, tenantCookie, runId),
  );

  const createdContracts = await Promise.all(contractPromises);
  console.log("\n[stress] Tất cả 5 hợp đồng đã hoàn tất luồng tạo, xác nhận và nộp cọc off-chain.");
  for (const c of createdContracts) {
    console.log(`  - #${c.index}: ${c.roomLabel} (ID: ${c.contractId})`);
  }

  // 3. Theo dõi hàng đợi on-chain cho đến khi TẤT CẢ các giao dịch đều CONFIRMED
  console.log("\n[stress] Đang chờ hàng đợi on-chain xử lý (ONCHAIN_AUTO_FLUSH)...");
  const contractIds = createdContracts.map((c) => c.contractId);
  const maxWaitMs = 180_000; // tối đa 3 phút cho 15 giao dịch trên Stellar Testnet
  const pollIntervalMs = 5_000;
  const startWaitTime = Date.now();

  let allConfirmed = false;
  let lastReport = [];

  while (Date.now() - startWaitTime < maxWaitMs) {
    // Thu thập trạng thái giao dịch của cả 5 hợp đồng
    const results = await Promise.all(
      contractIds.map(async (cid) => {
        const res = await api(landlordCookie, "GET", `/api/contracts/${cid}/onchain`);
        return {
          contractId: cid,
          txs: res.ok && Array.isArray(res.json?.data) ? res.json.data : [],
        };
      }),
    );

    lastReport = results;
    let pendingCount = 0;
    let submittedCount = 0;
    let confirmedCount = 0;
    let failedCount = 0;
    let totalTxs = 0;

    for (const r of results) {
      totalTxs += r.txs.length;
      for (const t of r.txs) {
        if (t.status === "CONFIRMED") confirmedCount++;
        else if (t.status === "SUBMITTED") submittedCount++;
        else if (t.status === "PENDING") pendingCount++;
        else if (t.status === "FAILED") failedCount++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[stress][+${elapsed}s] Tổng txs: ${totalTxs} | CONFIRMED: ${confirmedCount} | SUBMITTED: ${submittedCount} | PENDING: ${pendingCount} | FAILED: ${failedCount}`,
    );

    // Mỗi hợp đồng dự kiến có 3 txs: create_contract, tenant_confirm, record_deposit_paid
    const expectedTxs = CONTRACT_COUNT * 3;
    if (totalTxs >= expectedTxs && confirmedCount === totalTxs && pendingCount === 0 && submittedCount === 0) {
      allConfirmed = true;
      break;
    }

    if (failedCount > 0) {
      console.warn(`[stress] Phát hiện ${failedCount} giao dịch FAILED, dừng chờ để đối soát lỗi.`);
      break;
    }

    // Nếu hàng đợi chưa flush xong, có thể kích hoạt nhẹ flush-onchain qua API để đảm bảo tiến độ
    try {
      await api(landlordCookie, "POST", "/api/jobs/flush-onchain", { limit: 10, pollTimeoutMs: 8000 });
    } catch {
      // bỏ qua nếu auto-flush đang chạy
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n===============================================================");
  console.log("   KẾT QUẢ KIỂM THỬ ĐỒNG THỜI");
  console.log("===============================================================");
  console.log(`Thời gian thực thi: ${totalDurationSec}s`);
  console.log(`Số hợp đồng: ${CONTRACT_COUNT}`);

  let totalTxs = 0;
  let totalConfirmed = 0;
  let totalFailed = 0;
  let totalPendingOrSubmitted = 0;

  for (const r of lastReport) {
    const contract = createdContracts.find((c) => c.contractId === r.contractId);
    console.log(`\nHợp đồng: ${contract?.roomLabel} (${r.contractId})`);
    for (const t of r.txs) {
      totalTxs++;
      if (t.status === "CONFIRMED") totalConfirmed++;
      else if (t.status === "FAILED") totalFailed++;
      else totalPendingOrSubmitted++;

      console.log(
        `  - [${t.status}] Action: ${t.action} | Hash: ${t.txHash || "N/A"} | Explorer: ${t.explorerUrl || "N/A"}${t.error ? " | Error: " + t.error : ""}`,
      );
    }
  }

  console.log("\n---------------------------------------------------------------");
  console.log(`Tổng số giao dịch: ${totalTxs}`);
  console.log(`Số giao dịch CONFIRMED: ${totalConfirmed}`);
  console.log(`Số giao dịch FAILED: ${totalFailed}`);
  console.log(`Số giao dịch PENDING/SUBMITTED: ${totalPendingOrSubmitted}`);
  console.log("---------------------------------------------------------------");

  if (!allConfirmed || totalFailed > 0 || totalPendingOrSubmitted > 0) {
    console.error("\n❌ KIỂM THỬ THẤT BẠI: Vẫn còn giao dịch chưa CONFIRMED hoặc bị kẹt/lỗi!");
    process.exit(1);
  }

  console.log("\n✅ KIỂM THỬ THÀNH CÔNG: Mọi giao dịch của cả 5 hợp đồng đều CONFIRMED 100%!");
}

main().catch((err) => {
  console.error("Lỗi ngoại lệ trong quá trình stress test:", err);
  process.exit(1);
});
