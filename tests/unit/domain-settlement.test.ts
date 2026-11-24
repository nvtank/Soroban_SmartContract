import { describe, expect, it, vi } from "vitest";
import { settlePayment } from "@/domain/contracts/settlement";
import { FakeDomainRepository } from "@/domain/repository";

describe("settlePayment idempotent service", () => {
  async function setupRepo() {
    const repo = new FakeDomainRepository();
    const contractId = "contract-1";

    await repo.contracts.create({
      id: contractId,
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      tenant_phone_invited: "0901",
      room_label: "P.101",
      rent_amount: 5000000n,
      deposit_amount: 5000000n,
      start_date: "2026-01-01",
      end_date: "2026-06-30",
      due_day: 5,
      late_fee_bps_per_day: 50,
      terms_text: "Terms",
      doc_hash: "hash",
      doc_salt: "salt",
      status: "ACTIVE",
      onchain_ref: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await repo.deposits.create({
      contract_id: contractId,
      status: "UNPAID",
      paid_amount: 0n,
      refund_amount: 0n,
      deducted_amount: 0n,
      landlord_refund_amount: null,
      tenant_refund_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await repo.rentPeriods.createMany([
      {
        contract_id: contractId,
        period_no: 1,
        due_date: "2026-01-05",
        amount_due: 5000000n,
        amount_paid: 0n,
        late_days: 0,
        late_fee: 0n,
        status: "AWAITING_PAYMENT",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    return { repo, contractId };
  }

  it("settles CONFIRMED deposit payment: transitions deposit UNPAID -> RECORDED", async () => {
    const { repo, contractId } = await setupRepo();

    const paymentId = "payment-dep-1";
    await repo.payments.create({
      id: paymentId,
      contract_id: contractId,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 5000000n,
      provider: "PAYOS",
      order_code: 10001n,
      payment_ref_salt: "salt1",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-rec-dep" });
    await settlePayment(repo, paymentId, { enqueueOnchain: enqueueMock });

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("RECORDED");
    expect(deposit?.paid_amount).toBe(5000000n);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "record_deposit_paid", signer: { kind: "ORACLE" } }),
    );

    const payment = await repo.payments.findById(paymentId);
    expect(payment?.settled_at).toBeDefined();
  });

  it("settlePayment is idempotent: multiple calls do not re-apply", async () => {
    const { repo, contractId } = await setupRepo();

    const paymentId = "payment-dep-dup";
    await repo.payments.create({
      id: paymentId,
      contract_id: contractId,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 5000000n,
      provider: "PAYOS",
      order_code: 10002n,
      payment_ref_salt: "salt2",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-rec-dep" });
    await settlePayment(repo, paymentId, { enqueueOnchain: enqueueMock });
    expect(enqueueMock).toHaveBeenCalledTimes(1);

    // Call second and third time
    await settlePayment(repo, paymentId, { enqueueOnchain: enqueueMock });
    await settlePayment(repo, paymentId, { enqueueOnchain: enqueueMock });
    expect(enqueueMock).toHaveBeenCalledTimes(1); // Still 1, never re-enqueued
  });

  it("settles CONFIRMED rent payment: transitions rent period to PAID", async () => {
    const { repo, contractId } = await setupRepo();

    const paymentId = "payment-rent-1";
    await repo.payments.create({
      id: paymentId,
      contract_id: contractId,
      kind: "RENT",
      period_no: 1,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 5000000n,
      provider: "PAYOS",
      order_code: 10003n,
      payment_ref_salt: "salt3",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-rent" });
    await settlePayment(repo, paymentId, { enqueueOnchain: enqueueMock });

    const period = await repo.rentPeriods.findByPeriod(contractId, 1);
    expect(period?.status).toBe("PAID");
    expect(period?.amount_paid).toBe(5000000n);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "record_rent_paid", signer: { kind: "ORACLE" } }),
    );
  });

  it("settles UNDERPAID payment: rent transitions to PARTIALLY_PAID; deposit remains UNPAID", async () => {
    const { repo, contractId } = await setupRepo();

    // 1. Underpaid rent
    const rentPayId = "payment-rent-under";
    await repo.payments.create({
      id: rentPayId,
      contract_id: contractId,
      kind: "RENT",
      period_no: 1,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 2000000n,
      provider: "PAYOS",
      order_code: 10004n,
      payment_ref_salt: "salt4",
      status: "UNDERPAID",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    await settlePayment(repo, rentPayId);
    const period = await repo.rentPeriods.findByPeriod(contractId, 1);
    expect(period?.status).toBe("PARTIALLY_PAID");
    expect(period?.amount_paid).toBe(2000000n);

    // 2. Underpaid deposit
    const depPayId = "payment-dep-under";
    await repo.payments.create({
      id: depPayId,
      contract_id: contractId,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 3000000n,
      provider: "PAYOS",
      order_code: 10005n,
      payment_ref_salt: "salt5",
      status: "UNDERPAID",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    await settlePayment(repo, depPayId);
    const deposit = await repo.deposits.findByContractId(contractId);
    // Deposit CANNOT be RECORDED when underpaid!
    expect(deposit?.status).toBe("UNPAID");
  });
});
