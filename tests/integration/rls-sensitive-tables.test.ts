import "@/../tests/setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  createTestAdminClient,
  createTestAnonClient,
  createTestUserSessionClient,
} from "./helpers";
import { encryptSecret } from "@/lib/crypto/custody";

describe("RLS: Sensitive Tables Verification (auth_otps, auth_challenges, custody_wallets, payment_events, onchain_txs)", () => {
  const admin = createTestAdminClient();

  let userAId = "";
  let userBId = "";
  const emailA = `user_rls_sens_a_${Date.now()}@rentflow.local`;
  const emailB = `user_rls_sens_b_${Date.now()}@rentflow.local`;

  let contractABId = "";
  let onchainTxId = "";
  let otpId = "";
  let challengeId = "";
  let paymentEventId = "";

  const pairA = Keypair.random();
  const pairB = Keypair.random();

  beforeAll(async () => {
    // 1. Create test users
    const resA = await admin.auth.admin.createUser({
      email: emailA,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Sensitive Test Landlord" },
    });
    userAId = resA.data.user!.id;
    await admin.from("profiles").upsert({
      id: userAId,
      phone: "0992000001",
      full_name: "Sensitive Test Landlord",
      role: "LANDLORD",
    });

    const resB = await admin.auth.admin.createUser({
      email: emailB,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Sensitive Test Tenant" },
    });
    userBId = resB.data.user!.id;
    await admin.from("profiles").upsert({
      id: userBId,
      phone: "0992000002",
      full_name: "Sensitive Test Tenant",
      role: "TENANT",
    });

    // 2. Insert custody wallets
    await admin.from("custody_wallets").upsert([
      {
        user_id: userAId,
        stellar_public_key: pairA.publicKey(),
        encrypted_secret: encryptSecret(pairA.secret()),
        key_version: 1,
      },
      {
        user_id: userBId,
        stellar_public_key: pairB.publicKey(),
        encrypted_secret: encryptSecret(pairB.secret()),
        key_version: 1,
      },
    ]);

    // 3. Insert Contract AB
    const insContract = await admin.from("rental_contracts").insert({
      landlord_id: userAId,
      tenant_id: userBId,
      room_label: "Phòng RLS Test",
      rent_amount: 5000000,
      deposit_amount: 10000000,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      due_day: 5,
      status: "ACTIVE",
    }).select("id").single();
    contractABId = insContract.data!.id;

    // 4. Insert Onchain Tx
    const insTx = await admin.from("onchain_txs").insert({
      contract_id: contractABId,
      action: "record_deposit_paid",
      payload_hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      status: "CONFIRMED",
    }).select("id").single();
    onchainTxId = insTx.data!.id;

    // 5. Insert test OTP
    const insOtp = await admin.from("auth_otps").insert({
      phone: "0992000001",
      code: "654321",
      role: "LANDLORD",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }).select("id").single();
    otpId = insOtp.data!.id;

    // 6. Insert test Auth Challenge
    const insChallenge = await admin.from("auth_challenges").insert({
      user_id: userAId,
      challenge: "test-challenge-token",
      type: "STEP_UP",
      action: "SIGN_CONTRACT",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }).select("id").single();
    challengeId = insChallenge.data!.id;

    // 7. Insert test Payment Event
    const insEvent = await admin.from("payment_events").insert({
      provider: "PAYOS",
      order_code: 9876543210,
      event_key: `evt_${Date.now()}`,
    }).select("id").single();
    paymentEventId = insEvent.data!.id;
  });

  describe("1. auth_otps security", () => {
    it("BLOCKS authenticated user from selecting auth_otps", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { data, error } = await client.from("auth_otps").select("*");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
      expect(data).toBeNull();
    });

    it("BLOCKS anonymous client from selecting auth_otps", async () => {
      const anon = createTestAnonClient();
      const { data, error } = await anon.from("auth_otps").select("*");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
      expect(data).toBeNull();
    });

    it("BLOCKS authenticated user from inserting into auth_otps", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { error } = await client.from("auth_otps").insert({
        phone: "0992000001",
        code: "999999",
        expires_at: new Date().toISOString(),
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  describe("2. auth_challenges security", () => {
    it("BLOCKS authenticated user from selecting auth_challenges", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { data, error } = await client.from("auth_challenges").select("*");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
      expect(data).toBeNull();
    });

    it("BLOCKS anonymous client from selecting auth_challenges", async () => {
      const anon = createTestAnonClient();
      const { data, error } = await anon.from("auth_challenges").select("*");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
      expect(data).toBeNull();
    });
  });

  describe("3. payment_events security", () => {
    it("BLOCKS authenticated user from selecting payment_events", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { data, error } = await client.from("payment_events").select("*");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
      expect(data).toBeNull();
    });

    it("BLOCKS authenticated user from inserting into payment_events", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { error } = await client.from("payment_events").insert({
        provider: "SIMULATED",
        order_code: 1111111111,
        event_key: "forged_event",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  describe("4. onchain_txs security", () => {
    it("PREVENTS client from inserting into onchain_txs directly", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { error } = await client.from("onchain_txs").insert({
        contract_id: contractABId,
        action: "forge_tx",
        payload_hash: "0000000000000000000000000000000000000000000000000000000000000000",
        status: "CONFIRMED",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("PREVENTS client from updating onchain_txs directly", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { error } = await client
        .from("onchain_txs")
        .update({ status: "FAILED" })
        .eq("id", onchainTxId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("PREVENTS client from deleting onchain_txs", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { error } = await client
        .from("onchain_txs")
        .delete()
        .eq("id", onchainTxId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  describe("5. custody_wallets security", () => {
    it("BLOCKS client from selecting encrypted_secret", async () => {
      const client = await createTestUserSessionClient(emailA);
      const { data, error } = await client
        .from("custody_wallets")
        .select("encrypted_secret")
        .eq("user_id", userAId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
      expect(data).toBeNull();
    });

    it("BLOCKS user A from reading user B custody wallet row", async () => {
      const clientA = await createTestUserSessionClient(emailA);
      const { data, error } = await clientA
        .from("custody_wallets")
        .select("user_id, stellar_public_key")
        .eq("user_id", userBId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("BLOCKS client from inserting into custody_wallets", async () => {
      const clientA = await createTestUserSessionClient(emailA);
      const { error } = await clientA.from("custody_wallets").insert({
        user_id: userAId,
        stellar_public_key: "GBRANDOMKEY123",
        encrypted_secret: "fakepayload",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  afterAll(async () => {
    // Thorough cleanup of all test records, users, and wallets
    if (onchainTxId) await admin.from("onchain_txs").delete().eq("id", onchainTxId);
    if (contractABId) await admin.from("rental_contracts").delete().eq("id", contractABId);
    if (otpId) await admin.from("auth_otps").delete().eq("id", otpId);
    if (challengeId) await admin.from("auth_challenges").delete().eq("id", challengeId);
    if (paymentEventId) await admin.from("payment_events").delete().eq("id", paymentEventId);

    for (const id of [userAId, userBId]) {
      if (id) {
        await admin.from("custody_wallets").delete().eq("user_id", id);
        await admin.from("profiles").delete().eq("id", id);
        await admin.auth.admin.deleteUser(id);
      }
    }
  });
});
