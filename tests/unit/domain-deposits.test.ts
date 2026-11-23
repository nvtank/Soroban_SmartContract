import { describe, expect, it, vi } from "vitest";
import { approveRefund, requestRefund } from "@/domain/deposits/service";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository } from "@/domain/repository";

describe("domain deposits service", () => {
  const landlord: SessionUser = { id: "landlord-1", role: "LANDLORD", fullName: "Chủ nhà", phone: "0901" };
  const tenant: SessionUser = { id: "tenant-1", role: "TENANT", fullName: "Người thuê", phone: "0902" };
  const stranger: SessionUser = { id: "stranger-1", role: "TENANT", fullName: "Người ngoài", phone: "0903" };

  async function setupRecordedDeposit(repo: FakeDomainRepository) {
    const contractId = "contract-1";
    await repo.contracts.create({
      id: contractId,
      landlord_id: landlord.id,
      tenant_id: tenant.id,
      tenant_phone_invited: tenant.phone,
      room_label: "Phòng 101",
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
      status: "RECORDED",
      paid_amount: 5000000n,
      refund_amount: 0n,
      deducted_amount: 0n,
      landlord_refund_amount: null,
      tenant_refund_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return contractId;
  }

  it("either party can request refund, moving deposit to PENDING_REFUND", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupRecordedDeposit(repo);

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-ref" });
    const res = await requestRefund(repo, contractId, tenant, { enqueueOnchain: enqueueMock });

    expect(res.status).toBe("PENDING_REFUND");
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "request_refund" }),
    );
  });

  it("stranger cannot request refund", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupRecordedDeposit(repo);

    await expect(requestRefund(repo, contractId, stranger)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("only one party approves refund: remains PENDING_REFUND, no release", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupRecordedDeposit(repo);
    await requestRefund(repo, contractId, tenant);

    const stepUpMock = vi.fn().mockResolvedValue(undefined);
    const res = await approveRefund(
      repo,
      contractId,
      { refundAmount: "5000000" },
      landlord,
      new Request("http://localhost"),
      { requireStepUp: stepUpMock },
    );

    expect(res.status).toBe("PENDING_REFUND");
    expect(res.landlordRefundAmount).toBe("5000000");
    expect(res.tenantRefundAmount).toBeNull();
    expect(stepUpMock).toHaveBeenCalledWith(expect.anything(), landlord.id, "APPROVE_REFUND");

    // Contract must still be ACTIVE
    const contract = await repo.contracts.findById(contractId);
    expect(contract?.status).toBe("ACTIVE");
  });

  it("both parties approve with SAME amount: transitions to REFUNDED and contract ENDED", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupRecordedDeposit(repo);
    await requestRefund(repo, contractId, tenant);

    await approveRefund(repo, contractId, { refundAmount: "5000000" }, landlord);
    const res = await approveRefund(repo, contractId, { refundAmount: "5000000" }, tenant);

    expect(res.status).toBe("REFUNDED");
    expect(res.refundAmount).toBe("5000000");

    const contract = await repo.contracts.findById(contractId);
    expect(contract?.status).toBe("ENDED");
  });

  it("tình huống lỗi 5 & 6: both parties submit DIFFERENT refund amounts -> PENDING_DISPUTE, locked deposit", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupRecordedDeposit(repo);
    await requestRefund(repo, contractId, tenant);

    // Landlord wants to refund 4,000,000 (deducting 1,000,000)
    await approveRefund(repo, contractId, { refundAmount: "4000000" }, landlord);
    // Tenant expects full 5,000,000
    const res = await approveRefund(repo, contractId, { refundAmount: "5000000" }, tenant);

    expect(res.status).toBe("PENDING_DISPUTE");

    // Dispute must have been created and set to IN_PROGRESS
    const dispute = await repo.disputes.findByContractId(contractId);
    expect(dispute?.status).toBe("IN_PROGRESS");

    // Contract must NOT be ended
    const contract = await repo.contracts.findById(contractId);
    expect(contract?.status).toBe("ACTIVE");
  });

  it("cannot approve refund while dispute is active (DISPUTE_LOCKED)", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupRecordedDeposit(repo);
    await repo.disputes.create({
      contract_id: contractId,
      status: "IN_PROGRESS",
      opened_by: tenant.id,
      note: "Dispute active",
      landlord_agreed_amount: null,
      tenant_agreed_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      approveRefund(repo, contractId, { refundAmount: "5000000" }, landlord),
    ).rejects.toMatchObject({ code: "DISPUTE_LOCKED" });
  });
});
