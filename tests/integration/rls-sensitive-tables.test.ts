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

  describe("6. Privilege Escalation Prevention & Profiles Protection", () => {
    it("PREVENTS authenticated user from updating their own role column to ADMIN_DEMO via PostgREST", async () => {
      const client = await createTestUserSessionClient(emailB);
      const { error } = await client
        .from("profiles")
        .update({ role: "ADMIN_DEMO" })
        .eq("id", userBId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("PREVENTS authenticated user from updating their own role column to LANDLORD via PostgREST", async () => {
      const client = await createTestUserSessionClient(emailB);
      const { error } = await client
        .from("profiles")
        .update({ role: "LANDLORD" })
        .eq("id", userBId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("ALLOWS authenticated user to update their safe full_name column via PostgREST", async () => {
      const client = await createTestUserSessionClient(emailB);
      const { error } = await client
        .from("profiles")
        .update({ full_name: "Tenant Updated Name" })
        .eq("id", userBId);
      expect(error).toBeNull();

      const { data: profile } = await client
        .from("profiles")
        .select("full_name, role")
        .eq("id", userBId)
        .single();
      expect(profile?.full_name).toBe("Tenant Updated Name");
      expect(profile?.role).toBe("TENANT");
    });

    it("BLOCKS anonymous client from inserting or updating profiles directly", async () => {
      const anon = createTestAnonClient();
      const { error: insErr } = await anon.from("profiles").insert({
        id: crypto.randomUUID(),
        role: "ADMIN_DEMO",
        full_name: "Anon Injected Admin",
      });
      expect(insErr).not.toBeNull();
      expect(insErr?.message).toMatch(/permission denied/i);

      const { error: updErr } = await anon.from("profiles").update({
        role: "ADMIN_DEMO",
      }).eq("id", userAId);
      expect(updErr).not.toBeNull();
      expect(updErr?.message).toMatch(/permission denied/i);
    });

    it("IGNORES role in signUp options.data and assigns TENANT role even if ADMIN_DEMO is requested", async () => {
      const anon = createTestAnonClient();
      const hackerEmail = `hacker_signup_${Date.now()}@rentflow.local`;
      const { data: signUpData, error: signUpError } = await anon.auth.signUp({
        email: hackerEmail,
        password: "hacker-password-123",
        options: {
          data: {
            role: "ADMIN_DEMO",
            full_name: "Malicious Hacker",
          },
        },
      });
      expect(signUpError).toBeNull();
      expect(signUpData.user).not.toBeNull();
      const hackerId = signUpData.user!.id;

      try {
        // Query profile created by handle_new_user trigger via admin client
        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", hackerId)
          .single();

        expect(profileError).toBeNull();
        expect(profile).not.toBeNull();
        expect(profile?.role).toBe("TENANT");
        expect(profile?.role).not.toBe("ADMIN_DEMO");
      } finally {
        await admin.from("profiles").delete().eq("id", hackerId);
        await admin.auth.admin.deleteUser(hackerId);
      }
    });
  });

  describe("7. PostgREST RPC Lockdown", () => {
    it("BLOCKS anon client from executing any RPC functions via PostgREST", async () => {
      const anon = createTestAnonClient();

      const { error: errRate } = await anon.rpc("check_rate_limit", {
        p_key: "anon_test",
        p_max_requests: 5,
        p_window_seconds: 60,
      });
      expect(errRate).not.toBeNull();

      const { error: errSeed } = await anon.rpc("seed_demo_user", {
        p_id: crypto.randomUUID(),
        p_email: "anon_test@rentflow.local",
        p_phone: "0999999991",
        p_full_name: "Anon Seed Attempt",
        p_role: "ADMIN_DEMO",
      });
      expect(errSeed).not.toBeNull();

      const { error: errWhoami } = await anon.rpc("test_whoami");
      expect(errWhoami).not.toBeNull();
    });

    it("BLOCKS authenticated client from executing sensitive RPC functions via PostgREST", async () => {
      const client = await createTestUserSessionClient(emailA);

      const { error: errRate } = await client.rpc("check_rate_limit", {
        p_key: "user_test",
        p_max_requests: 5,
        p_window_seconds: 60,
      });
      expect(errRate).not.toBeNull();

      const { error: errSeed } = await client.rpc("seed_demo_user", {
        p_id: crypto.randomUUID(),
        p_email: "user_test@rentflow.local",
        p_phone: "0999999992",
        p_full_name: "User Seed Attempt",
        p_role: "ADMIN_DEMO",
      });
      expect(errSeed).not.toBeNull();

      const { error: errWhoami } = await client.rpc("test_whoami");
      expect(errWhoami).not.toBeNull();
    });

    it("ALLOWS internal service_role (admin) to execute functions like check_rate_limit", async () => {
      const { data, error } = await admin.rpc("check_rate_limit", {
        p_key: `service_role_test_${Date.now()}`,
        p_max_requests: 5,
        p_window_seconds: 60,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  describe("8. PostgREST Business Logic Enforcement (Direct Mutation Blocked)", () => {
    it("BLOCKS participant from modifying rental_contracts status or deposit_amount via PostgREST", async () => {
      const clientA = await createTestUserSessionClient(emailA);

      // Attempt to modify status (bypassing state machine)
      const { error: errStatus } = await clientA
        .from("rental_contracts")
        .update({ status: "ENDED" })
        .eq("id", contractABId);
      expect(errStatus).not.toBeNull();
      expect(errStatus?.message).toMatch(/permission denied/i);

      // Attempt to modify deposit_amount
      const { error: errDeposit } = await clientA
        .from("rental_contracts")
        .update({ deposit_amount: 1 })
        .eq("id", contractABId);
      expect(errDeposit).not.toBeNull();
      expect(errDeposit?.message).toMatch(/permission denied/i);
    });

    it("BLOCKS client from inserting passkey_credentials directly (bypassing WebAuthn/step-up)", async () => {
      const clientA = await createTestUserSessionClient(emailA);
      const { error: errPasskey } = await clientA
        .from("passkey_credentials")
        .insert({
          user_id: userAId,
          credential_id: `forged_credential_${Date.now()}`,
          public_key: "forged_pubkey",
          counter: 0,
        });
      expect(errPasskey).not.toBeNull();
      expect(errPasskey?.message).toMatch(/permission denied/i);
    });

    it("BLOCKS client from modifying recovery_requests status directly", async () => {
      // Insert a test recovery request using admin
      const insRec = await admin.from("recovery_requests").insert({
        user_id: userAId,
        phone: "0992000001",
        status: "PENDING",
        note: "Test recovery note",
      }).select("id").single();
      const recId = insRec.data!.id;

      try {
        const clientA = await createTestUserSessionClient(emailA);
        const { error: errRecovery } = await clientA
          .from("recovery_requests")
          .update({ status: "APPROVED" })
          .eq("id", recId);
        expect(errRecovery).not.toBeNull();
        expect(errRecovery?.message).toMatch(/permission denied/i);
      } finally {
        await admin.from("recovery_requests").delete().eq("id", recId);
      }
    });

    it("BLOCKS client from modifying notification title, but ALLOWS updating read_at", async () => {
      // Insert notification for user A via admin
      const insNotif = await admin.from("notifications").insert({
        user_id: userAId,
        type: "CONTRACT_CONFIRMED",
        title: "Original Notification Title",
        body: "Notification body content",
      }).select("id").single();
      const notifId = insNotif.data!.id;

      try {
        const clientA = await createTestUserSessionClient(emailA);

        // Attempt to update title -> REJECTED (permission denied for table notifications)
        const { error: errTitle } = await clientA
          .from("notifications")
          .update({ title: "Forged Title By User" })
          .eq("id", notifId);
        expect(errTitle).not.toBeNull();
        expect(errTitle?.message).toMatch(/permission denied/i);

        // Update read_at -> ALLOWED
        const nowIso = new Date().toISOString();
        const { error: errReadAt } = await clientA
          .from("notifications")
          .update({ read_at: nowIso })
          .eq("id", notifId);
        expect(errReadAt).toBeNull();
      } finally {
        await admin.from("notifications").delete().eq("id", notifId);
      }
    });

    it("BLOCKS anonymous client from selecting onchain_txs", async () => {
      const anon = createTestAnonClient();
      const { data: anonData, error: anonError } = await anon
        .from("onchain_txs")
        .select("*")
        .eq("id", onchainTxId);
      expect(anonError).not.toBeNull();
      expect(anonError?.message).toMatch(/permission denied/i);
      expect(anonData).toBeNull();
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
