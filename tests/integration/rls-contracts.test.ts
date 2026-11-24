import "@/../tests/setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAdminClient,
  createTestUserSessionClient,
} from "./helpers";

describe("RLS: Contract Isolation between Users", () => {
  const admin = createTestAdminClient();

  let userAId = "";
  let userBId = "";
  let userCId = "";

  const emailA = `usera_${Date.now()}@rentflow.local`;
  const emailB = `userb_${Date.now()}@rentflow.local`;
  const emailC = `userc_${Date.now()}@rentflow.local`;

  let contractAB = "";
  let contractCB = "";

  beforeAll(async () => {
    // 1. Create auth users and profiles for test
    const resA = await admin.auth.admin.createUser({
      email: emailA,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Test User A" },
    });
    userAId = resA.data.user!.id;
    await admin.from("profiles").upsert({
      id: userAId,
      phone: "0990000001",
      full_name: "Test User A",
      role: "LANDLORD",
    });

    const resB = await admin.auth.admin.createUser({
      email: emailB,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Test User B" },
    });
    userBId = resB.data.user!.id;
    await admin.from("profiles").upsert({
      id: userBId,
      phone: "0990000002",
      full_name: "Test User B",
      role: "TENANT",
    });

    const resC = await admin.auth.admin.createUser({
      email: emailC,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Test User C" },
    });
    userCId = resC.data.user!.id;
    await admin.from("profiles").upsert({
      id: userCId,
      phone: "0990000003",
      full_name: "Test User C",
      role: "LANDLORD",
    });

    // 2. Create Contract AB (Landlord A + Tenant B)
    const insAB = await admin.from("rental_contracts").insert({
      landlord_id: userAId,
      tenant_id: userBId,
      room_label: "Phòng A-101",
      rent_amount: 5000000,
      deposit_amount: 10000000,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      due_day: 5,
      status: "ACTIVE",
    }).select("id").single();
    contractAB = insAB.data!.id;

    // 3. Create Contract CB (Landlord C + Tenant B)
    const insCB = await admin.from("rental_contracts").insert({
      landlord_id: userCId,
      tenant_id: userBId,
      room_label: "Phòng C-202",
      rent_amount: 6000000,
      deposit_amount: 12000000,
      start_date: "2026-02-01",
      end_date: "2027-01-31",
      due_day: 10,
      status: "ACTIVE",
    }).select("id").single();
    contractCB = insCB.data!.id;
  });

  it("allows User A (participant) to read contract AB", async () => {
    const clientA = await createTestUserSessionClient(emailA);
    const { data, error } = await clientA
      .from("rental_contracts")
      .select("id, room_label")
      .eq("id", contractAB);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(contractAB);
  });

  it("PREVENTS User A from reading contract CB (non-participant)", async () => {
    const clientA = await createTestUserSessionClient(emailA);
    const { data, error } = await clientA
      .from("rental_contracts")
      .select("id, room_label")
      .eq("id", contractCB);

    expect(error).toBeNull();
    // RLS filters out rows the user is not allowed to see
    expect(data).toHaveLength(0);
  });

  it("PREVENTS User C from reading contract AB (non-participant)", async () => {
    const clientC = await createTestUserSessionClient(emailC);
    const { data, error } = await clientC
      .from("rental_contracts")
      .select("id, room_label")
      .eq("id", contractAB);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("allows User B (tenant in both) to read both contracts", async () => {
    const clientB = await createTestUserSessionClient(emailB);
    const { data, error } = await clientB
      .from("rental_contracts")
      .select("id")
      .in("id", [contractAB, contractCB]);

    expect(error).toBeNull();
    expect(data?.map((c) => c.id)).toContain(contractAB);
    expect(data?.map((c) => c.id)).toContain(contractCB);
  });

  afterAll(async () => {
    // Clean up test contracts and users
    if (contractAB) await admin.from("rental_contracts").delete().eq("id", contractAB);
    if (contractCB) await admin.from("rental_contracts").delete().eq("id", contractCB);
    for (const id of [userAId, userBId, userCId]) {
      if (id) {
        await admin.from("custody_wallets").delete().eq("user_id", id);
        await admin.from("profiles").delete().eq("id", id);
        await admin.auth.admin.deleteUser(id);
      }
    }
  });
});
