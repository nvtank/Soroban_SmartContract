import { describe, expect, it } from "vitest";
import { encodeContractArgs } from "@/lib/stellar/abi";
import { completeAbiArgs, isAbiComplete } from "@/lib/stellar/resolve-args";

const CONTRACT_ID = "11111111-2222-3333-4444-555555555555";
const LANDLORD = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TENANT = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
const SIGNER = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const HASH = "ab".repeat(32);

/** Mô phỏng PostgREST: mỗi bảng trả đúng một dòng. */
function fakeDb(
  parties: { landlord_id: string | null; tenant_id: string | null } | null,
  wallets: Record<string, string>,
) {
  return {
    from(table: string) {
      return {
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => {
              if (table === "rental_contracts") return { data: parties, error: null };
              const key = wallets[value];
              return key ? { data: { stellar_public_key: key }, error: null } : { data: null, error: null };
            },
          }),
        }),
      };
    },
  };
}

const db = fakeDb(
  { landlord_id: "u-landlord", tenant_id: "u-tenant" },
  { "u-landlord": LANDLORD, "u-tenant": TENANT, "u-signer": SIGNER },
);

describe("completeAbiArgs", () => {
  it("adds landlord and tenant wallets to create_contract and the result encodes", async () => {
    const out = (await completeAbiArgs(db, {
      action: "create_contract",
      args: [CONTRACT_ID, HASH, "6000000", "3000000", 5, 20],
      contractId: CONTRACT_ID,
      signer: { kind: "USER", userId: "u-landlord" },
    })) as unknown[];
    expect(out).toHaveLength(8);
    expect(out[1]).toBe(LANDLORD);
    expect(out[2]).toBe(TENANT);
    expect(encodeContractArgs("create_contract", out)).toHaveLength(8);
  });

  it("uses the signer wallet as the party for refund and dispute actions", async () => {
    const out = (await completeAbiArgs(db, {
      action: "approve_refund",
      args: [CONTRACT_ID, "6000000"],
      contractId: CONTRACT_ID,
      signer: { kind: "USER", userId: "u-signer" },
    })) as unknown[];
    expect(out).toEqual([CONTRACT_ID, SIGNER, "6000000"]);
  });

  it("uses the contract parties for tenant_confirm, propose_deduction and respond_deduction", async () => {
    const signer = { kind: "USER", userId: "u-x" } as const;
    expect(
      await completeAbiArgs(db, {
        action: "tenant_confirm",
        args: [CONTRACT_ID],
        contractId: CONTRACT_ID,
        signer,
      }),
    ).toEqual([CONTRACT_ID, TENANT]);
    expect(
      await completeAbiArgs(db, {
        action: "propose_deduction",
        args: [CONTRACT_ID, "500000", HASH],
        contractId: CONTRACT_ID,
        signer,
      }),
    ).toEqual([CONTRACT_ID, LANDLORD, "500000", HASH]);
    expect(
      await completeAbiArgs(db, {
        action: "respond_deduction",
        args: [CONTRACT_ID, false],
        contractId: CONTRACT_ID,
        signer,
      }),
    ).toEqual([CONTRACT_ID, TENANT, false]);
  });

  it("leaves oracle actions and already complete arguments untouched", async () => {
    const oracle = { kind: "ORACLE" } as const;
    const rent = [CONTRACT_ID, 1, "3000000", HASH];
    expect(
      await completeAbiArgs(db, {
        action: "record_rent_paid",
        args: rent,
        contractId: CONTRACT_ID,
        signer: oracle,
      }),
    ).toBe(rent);
    const full = [CONTRACT_ID, TENANT];
    expect(
      await completeAbiArgs(db, {
        action: "tenant_confirm",
        args: full,
        contractId: CONTRACT_ID,
        signer: oracle,
      }),
    ).toBe(full);
    expect(isAbiComplete("record_rent_paid", rent)).toBe(true);
    expect(isAbiComplete("tenant_confirm", [CONTRACT_ID])).toBe(false);
  });

  it("fails with a clear error when the tenant has no wallet yet instead of inventing one", async () => {
    const noTenant = fakeDb({ landlord_id: "u-landlord", tenant_id: null }, { "u-landlord": LANDLORD });
    await expect(
      completeAbiArgs(noTenant, {
        action: "create_contract",
        args: [CONTRACT_ID, HASH, "6000000", "3000000", 5, 20],
        contractId: CONTRACT_ID,
        signer: { kind: "USER", userId: "u-landlord" },
      }),
    ).rejects.toThrow(/người thuê/);
  });

  it("fails when the contract does not exist", async () => {
    await expect(
      completeAbiArgs(fakeDb(null, {}), {
        action: "tenant_confirm",
        args: [CONTRACT_ID],
        contractId: CONTRACT_ID,
        signer: { kind: "USER", userId: "u" },
      }),
    ).rejects.toThrow(/hợp đồng/);
  });
});
