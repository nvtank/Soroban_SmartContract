import "@/../tests/setup";
import { beforeAll, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  createTestAdminClient,
  createTestAnonClient,
  createTestUserSessionClient,
} from "./helpers";
import { decryptSecret, encryptSecret } from "@/lib/crypto/custody";

describe("RLS: Custody Wallets & Encrypted Secret Protection", () => {
  const admin = createTestAdminClient();

  let userAId = "";
  let userBId = "";

  const emailA = `usera_custody_${Date.now()}@rentflow.local`;
  const emailB = `userb_custody_${Date.now()}@rentflow.local`;

  const pairA = Keypair.random();
  const pairB = Keypair.random();

  beforeAll(async () => {
    // 1. Create users
    const resA = await admin.auth.admin.createUser({
      email: emailA,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Custody User A" },
    });
    userAId = resA.data.user!.id;
    await admin.from("profiles").upsert({
      id: userAId,
      phone: "0991000001",
      full_name: "Custody User A",
      role: "TENANT",
    });

    const resB = await admin.auth.admin.createUser({
      email: emailB,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Custody User B" },
    });
    userBId = resB.data.user!.id;
    await admin.from("profiles").upsert({
      id: userBId,
      phone: "0991000002",
      full_name: "Custody User B",
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
  });

  it("PREVENTS client from selecting encrypted_secret column (column-level revocation)", async () => {
    const clientA = await createTestUserSessionClient(emailA);

    // Attempt to select encrypted_secret
    const { data, error } = await clientA
      .from("custody_wallets")
      .select("encrypted_secret")
      .eq("user_id", userAId);

    // Postgres raises permission denied on encrypted_secret
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied/i);
    expect(data).toBeNull();
  });

  it("PREVENTS client from selecting * (which includes encrypted_secret)", async () => {
    const clientA = await createTestUserSessionClient(emailA);

    const { data, error } = await clientA
      .from("custody_wallets")
      .select("*")
      .eq("user_id", userAId);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied/i);
    expect(data).toBeNull();
  });

  it("allows client A to select only public columns of their own custody wallet", async () => {
    const clientA = await createTestUserSessionClient(emailA);

    const { data, error } = await clientA
      .from("custody_wallets")
      .select("user_id, stellar_public_key, key_version")
      .eq("user_id", userAId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].user_id).toBe(userAId);
    expect(data?.[0].stellar_public_key).toBe(pairA.publicKey());
  });

  it("PREVENTS client A from reading client B's custody wallet", async () => {
    const clientA = await createTestUserSessionClient(emailA);

    const { data, error } = await clientA
      .from("custody_wallets")
      .select("user_id, stellar_public_key, key_version")
      .eq("user_id", userBId);

    expect(error).toBeNull();
    // RLS blocks reading other users' rows
    expect(data).toHaveLength(0);
  });

  it("PREVENTS anonymous clients from reading custody wallets", async () => {
    const anon = createTestAnonClient();

    const { data, error } = await anon
      .from("custody_wallets")
      .select("user_id, stellar_public_key");

    // Anon has no grant or returns empty
    expect(error !== null || (data && data.length === 0)).toBe(true);
  });

  it("allows service role to read encrypted_secret and decrypt the keypair", async () => {
    const { data, error } = await admin
      .from("custody_wallets")
      .select("encrypted_secret")
      .eq("user_id", userAId)
      .single();

    expect(error).toBeNull();
    expect(data?.encrypted_secret).toBeDefined();

    const decrypted = decryptSecret(data!.encrypted_secret);
    expect(decrypted).toBe(pairA.secret());
  });
});
