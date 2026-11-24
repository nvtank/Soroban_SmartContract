import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/http";
import { extendDue } from "@/domain/rent/extend-due";
import { FakeDomainRepository } from "@/domain/repository";
import type { SessionUser } from "@/domain/dto";

const landlord: SessionUser = { id: "landlord-1", role: "LANDLORD", fullName: null, phone: null };
const tenant: SessionUser = { id: "tenant-1", role: "TENANT", fullName: null, phone: null };

async function setup(
  periodStatus: "OVERDUE" | "AWAITING_PAYMENT" | "PAID" = "OVERDUE",
  contractStatus = "ACTIVE",
) {
  const repo = new FakeDomainRepository();
  const now = new Date().toISOString();
  await repo.contracts.create({
    id: "c1",
    landlord_id: "landlord-1",
    tenant_id: "tenant-1",
    tenant_phone_invited: null,
    room_label: "P.1",
    rent_amount: 3000000n,
    deposit_amount: 6000000n,
    start_date: "2026-10-01",
    end_date: "2027-09-30",
    due_day: 5,
    late_fee_bps_per_day: 20,
    terms_text: "t",
    doc_hash: "h",
    doc_salt: "s",
    status: contractStatus as "ACTIVE",
    onchain_ref: null,
    created_at: now,
    updated_at: now,
  });
  await repo.rentPeriods.createMany([
    {
      contract_id: "c1",
      period_no: 1,
      due_date: "2026-10-05",
      amount_due: 3000000n,
      amount_paid: 0n,
      late_days: 50,
      late_fee: 300000n,
      status: periodStatus,
      created_at: now,
      updated_at: now,
    },
  ]);
  return repo;
}
const input = { newDueDate: "2026-12-20" };
const deps = (enqueueOnchain = vi.fn()) => ({ enqueueOnchain, today: () => "2026-11-24" });

describe("extendDue (landlord grace period)", () => {
  it("moves an overdue period back to awaiting payment, waives the late fee and records it on-chain", async () => {
    const repo = await setup();
    const enqueue = vi.fn();
    const result = await extendDue(repo, "c1", 1, input, landlord, deps(enqueue));
    expect(result).toMatchObject({
      status: "AWAITING_PAYMENT",
      dueDate: "2026-12-20",
      lateDays: 0,
      lateFee: "0",
    });

    const stored = await repo.rentPeriods.findByPeriod("c1", 1);
    expect(stored?.status).toBe("AWAITING_PAYMENT");
    expect(stored?.late_fee).toBe(0n);

    expect(enqueue).toHaveBeenCalledTimes(1);
    const call = enqueue.mock.calls[0][1];
    expect(call.action).toBe("extend_due");
    expect(call.signer).toEqual({ kind: "USER", userId: "landlord-1" });
    expect(call.args).toEqual(["c1", 1, Math.floor(Date.parse("2026-12-20T00:00:00+07:00") / 1000)]);
    // không chứa dữ liệu cá nhân hay tên phòng
    expect(JSON.stringify(call.args)).not.toContain("P.1");
  });

  it("only the contract's landlord may extend", async () => {
    const repo = await setup();
    await expect(extendDue(repo, "c1", 1, input, tenant, deps())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(extendDue(repo, "c1", 1, input, { ...landlord, id: "other" }, deps())).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("rejects periods that are not overdue", async () => {
    for (const status of ["AWAITING_PAYMENT", "PAID"] as const) {
      const repo = await setup(status);
      await expect(extendDue(repo, "c1", 1, input, landlord, deps())).rejects.toBeInstanceOf(ApiError);
    }
  });

  it("rejects a new due date that is not after today and the old due date", async () => {
    const repo = await setup();
    for (const newDueDate of ["2026-11-24", "2026-11-01", "2026-10-05"]) {
      await expect(extendDue(repo, "c1", 1, { newDueDate }, landlord, deps())).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    }
    expect((await repo.rentPeriods.findByPeriod("c1", 1))?.status).toBe("OVERDUE");
  });

  it("rejects contracts that are not active and unknown periods", async () => {
    await expect(
      extendDue(await setup("OVERDUE", "ENDED"), "c1", 1, input, landlord, deps()),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(extendDue(await setup(), "c1", 9, input, landlord, deps())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not fail the business action when the on-chain queue errors", async () => {
    const repo = await setup();
    const failing = vi.fn().mockRejectedValue(new Error("rpc down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(extendDue(repo, "c1", 1, input, landlord, deps(failing))).resolves.toMatchObject({
      status: "AWAITING_PAYMENT",
    });
    quiet.mockRestore();
  });
});
