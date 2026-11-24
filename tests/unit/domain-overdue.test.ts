import { describe, expect, it, vi } from "vitest";
import { scanOverdue } from "@/domain/jobs/overdue-scan";
import { FakeDomainRepository } from "@/domain/repository";

describe("overdue scan & late fee job", () => {
  it("scans overdue rent periods, applies late fee, and enqueues mark_overdue onchain", async () => {
    const repo = new FakeDomainRepository();
    const contractId = "contract-1";

    await repo.contracts.create({
      id: contractId,
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      tenant_phone_invited: "0901",
      room_label: "P.201",
      rent_amount: 10000000n, // 10,000,000 VND
      deposit_amount: 10000000n,
      start_date: "2026-01-01",
      end_date: "2026-06-30",
      due_day: 5,
      late_fee_bps_per_day: 50, // 0.5% per day = 50 bps
      terms_text: "Terms",
      doc_hash: "hash",
      doc_salt: "salt",
      status: "ACTIVE",
      onchain_ref: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Due date was 2026-01-05
    await repo.rentPeriods.createMany([
      {
        contract_id: contractId,
        period_no: 1,
        due_date: "2026-01-05",
        amount_due: 10000000n,
        amount_paid: 0n,
        late_days: 0,
        late_fee: 0n,
        status: "AWAITING_PAYMENT",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-overdue" });

    // Run scan as of 2026-01-15 (10 days late)
    const result = await scanOverdue(repo, { asOfDate: "2026-01-15" }, { enqueueOnchain: enqueueMock });

    expect(result.scannedCount).toBe(1);
    expect(result.overdueCount).toBe(1);

    const updated = result.updatedPeriods[0];
    expect(updated.periodNo).toBe(1);
    expect(updated.daysLate).toBe(10);

    // late_fee = rent * bps * days / 10000
    // 10,000,000 * 50 * 10 / 10,000 = 500,000 VND
    expect(updated.lateFee).toBe("500000");

    const period = await repo.rentPeriods.findByPeriod(contractId, 1);
    expect(period?.status).toBe("OVERDUE");
    expect(period?.late_days).toBe(10);
    expect(period?.late_fee).toBe(500000n);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "mark_overdue",
        args: [contractId, 1, 10],
        signer: { kind: "ORACLE" },
      }),
    );
  });
});
