import "@/../tests/setup";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestAdminClient, createTestAnonClient } from "./helpers";

describe("Stellar Outbox Concurrency & Atomic Claim Integration", () => {
  const admin = createTestAdminClient();
  const anon = createTestAnonClient();

  let testLandlordId = "";
  let contractAId = "";
  let contractBId = "";
  let contractCId = "";
  let contractDId = "";

  const createdTxIds: string[] = [];

  beforeAll(async () => {
    // 1. Tạo test landlord
    const email = `landlord_concurrency_${Date.now()}@rentflow.local`;
    const res = await admin.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Stellar Concurrency Landlord" },
    });
    testLandlordId = res.data.user!.id;

    await admin.from("profiles").upsert({
      id: testLandlordId,
      phone: `09${Date.now().toString().slice(-8)}`,
      full_name: "Stellar Concurrency Landlord",
      role: "LANDLORD",
    });

    // 2. Tạo các hợp đồng test
    const makeContract = async (label: string) => {
      const { data } = await admin
        .from("rental_contracts")
        .insert({
          landlord_id: testLandlordId,
          room_label: label,
          rent_amount: 5000000,
          deposit_amount: 10000000,
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          due_day: 5,
          late_fee_bps_per_day: 50,
          status: "ACTIVE",
        })
        .select("id")
        .single();
      return data!.id;
    };

    contractAId = await makeContract("Phòng A");
    contractBId = await makeContract("Phòng B");
    contractCId = await makeContract("Phòng C");
    contractDId = await makeContract("Phòng D");
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    for (const txId of createdTxIds) {
      await admin.from("onchain_txs").delete().eq("id", txId);
    }
    const contracts = [contractAId, contractBId, contractCId, contractDId].filter(Boolean);
    for (const cid of contracts) {
      await admin.from("onchain_txs").delete().eq("contract_id", cid);
      await admin.from("rental_contracts").delete().eq("id", cid);
    }
    if (testLandlordId) {
      await admin.from("profiles").delete().eq("id", testLandlordId);
      await admin.auth.admin.deleteUser(testLandlordId);
    }
  });

  it("chặn anon client không được gọi trực tiếp hàm claim_onchain_txs (bảo mật RPC)", async () => {
    const { error } = await anon.rpc("claim_onchain_txs", {
      p_worker_id: "malicious-anon-worker",
      p_limit: 10,
      p_lock_timeout_seconds: 60,
    });

    expect(error).not.toBeNull();
    // PostgreSQL sẽ từ chối do đã REVOKE EXECUTE FROM anon, public, authenticated
    expect(error?.message).toMatch(/permission denied|does not exist/i);
  });

  it("hai worker chạy đồng thời claim nguyên tử: không trùng giao dịch, không đụng hợp đồng, giữ FIFO", async () => {
    // Tạo 2 tx cho Contract A (txA1 trước, txA2 sau)
    const baseTime = Date.now();
    const tA1 = new Date(baseTime - 4000).toISOString();
    const tA2 = new Date(baseTime - 3000).toISOString();
    const tB1 = new Date(baseTime - 2000).toISOString();
    const tB2 = new Date(baseTime - 1000).toISOString();

    const insertTx = async (cid: string, action: string, createdAt: string, status = "PENDING") => {
      const { data } = await admin
        .from("onchain_txs")
        .insert({
          contract_id: cid,
          action,
          payload_hash: "hash-" + Math.random(),
          args: { id: cid },
          signer: { kind: "USER", userId: testLandlordId },
          status,
          created_at: createdAt,
          retry_count: 0,
        })
        .select("*")
        .single();
      createdTxIds.push(data!.id);
      return data!;
    };

    const txA1 = await insertTx(contractAId, "create_contract", tA1);
    const txA2 = await insertTx(contractAId, "tenant_confirm", tA2);
    const txB1 = await insertTx(contractBId, "create_contract", tB1);
    const txB2 = await insertTx(contractBId, "tenant_confirm", tB2);

    // Chạy đồng thời 2 worker claim qua service_role
    const worker1Promise = admin.rpc("claim_onchain_txs", {
      p_worker_id: "worker-alpha",
      p_limit: 1,
      p_lock_timeout_seconds: 60,
    });
    const worker2Promise = admin.rpc("claim_onchain_txs", {
      p_worker_id: "worker-beta",
      p_limit: 1,
      p_lock_timeout_seconds: 60,
    });

    const [res1, res2] = await Promise.all([worker1Promise, worker2Promise]);

    expect(res1.error).toBeNull();
    expect(res2.error).toBeNull();

    const claimed1 = res1.data || [];
    const claimed2 = res2.data || [];

    // Cả hai worker đều claim được 1 giao dịch
    expect(claimed1.length).toBe(1);
    expect(claimed2.length).toBe(1);

    const id1 = claimed1[0].id;
    const id2 = claimed2[0].id;

    // Hai worker TUYỆT ĐỐI không claim trùng id
    expect(id1).not.toBe(id2);

    // Cả 2 giao dịch được claim phải là tx đầu tiên (A1 và B1), TUYỆT ĐỐI không được claim A2 hay B2
    const claimedIds = new Set([id1, id2]);
    expect(claimedIds.has(txA1.id)).toBe(true);
    expect(claimedIds.has(txB1.id)).toBe(true);
    expect(claimedIds.has(txA2.id)).toBe(false);
    expect(claimedIds.has(txB2.id)).toBe(false);

    // Hai worker không cùng xử lý một hợp đồng
    const contract1 = claimed1[0].contract_id;
    const contract2 = claimed2[0].contract_id;
    expect(contract1).not.toBe(contract2);
  });

  it("giao dịch lỗi (FAILED) chặn đúng các giao dịch sau của cùng hợp đồng", async () => {
    // Tạo hợp đồng C có tx đầu tiên bị FAILED, tx thứ hai là PENDING
    const baseTime = Date.now();
    const tC1 = new Date(baseTime - 2000).toISOString();
    const tC2 = new Date(baseTime - 1000).toISOString();

    const insertTx = async (cid: string, action: string, createdAt: string, status = "PENDING") => {
      const { data } = await admin
        .from("onchain_txs")
        .insert({
          contract_id: cid,
          action,
          payload_hash: "hash-" + Math.random(),
          args: { id: cid },
          signer: { kind: "USER", userId: testLandlordId },
          status,
          created_at: createdAt,
          retry_count: 0,
        })
        .select("*")
        .single();
      createdTxIds.push(data!.id);
      return data!;
    };

    const txC1 = await insertTx(contractCId, "create_contract", tC1, "FAILED");
    const txC2 = await insertTx(contractCId, "tenant_confirm", tC2, "PENDING");

    // Worker claim các giao dịch có thể chạy
    const { data: claimed, error } = await admin.rpc("claim_onchain_txs", {
      p_worker_id: "worker-checker",
      p_limit: 10,
      p_lock_timeout_seconds: 60,
    });

    expect(error).toBeNull();
    const claimedList = claimed || [];

    // Giao dịch C2 KHÔNG ĐƯỢC PHÉP claim vì C1 đang FAILED (bị chặn)
    const claimedIds = new Set(claimedList.map((x: { id: string }) => x.id));
    expect(claimedIds.has(txC1.id)).toBe(false);
    expect(claimedIds.has(txC2.id)).toBe(false);
  });
});
