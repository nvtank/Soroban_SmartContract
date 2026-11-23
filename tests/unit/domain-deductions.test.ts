import { describe, expect, it, vi } from "vitest";
import { proposeDeduction, respondDeduction } from "@/domain/deductions/service";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository } from "@/domain/repository";

describe("domain deductions service", () => {
  const landlord: SessionUser = { id: "landlord-1", role: "LANDLORD", fullName: "Chủ nhà", phone: "0901" };
  const tenant: SessionUser = { id: "tenant-1", role: "TENANT", fullName: "Người thuê", phone: "0902" };
  const stranger: SessionUser = { id: "stranger-1", role: "TENANT", fullName: "Người ngoài", phone: "0903" };

  async function setupDeposit(repo: FakeDomainRepository, depositAmount = 5000000n) {
    const contractId = "contract-1";
    await repo.contracts.create({
      id: contractId,
      landlord_id: landlord.id,
      tenant_id: tenant.id,
      tenant_phone_invited: tenant.phone,
      room_label: "Phòng 101",
      rent_amount: 5000000n,
      deposit_amount: depositAmount,
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
      paid_amount: depositAmount,
      refund_amount: 0n,
      deducted_amount: 0n,
      landlord_refund_amount: null,
      tenant_refund_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return contractId;
  }

  it("landlord proposes deduction successfully, deposit moves to PENDING_REFUND", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDeposit(repo);

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-ded" });
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "1000000", reasonText: "Làm hỏng điều hòa" },
      landlord,
      { enqueueOnchain: enqueueMock },
    );

    expect(deduction.id).toBeDefined();
    expect(deduction.status).toBe("PROPOSED");
    expect(deduction.amount).toBe("1000000");

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_REFUND");

    // Verify onchain called with reason_hash (no raw reason text)
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "propose_deduction",
        signer: { kind: "USER", userId: landlord.id },
      }),
    );
    const args = enqueueMock.mock.calls[0][1].args;
    expect(JSON.stringify(args)).not.toContain("Làm hỏng điều hòa");
  });

  it("deduction amount cannot exceed deposit amount", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDeposit(repo, 5000000n);

    await expect(
      proposeDeduction(repo, contractId, { amount: "6000000", reasonText: "Hỏng nặng" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("tenant accepts deduction: deduction ACCEPTED, deposit DEDUCTED with remaining refund", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDeposit(repo);
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "1500000", reasonText: "Hỏng vòi hoa sen" },
      landlord,
    );

    const stepUpMock = vi.fn().mockResolvedValue(undefined);
    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-resp" });

    const responded = await respondDeduction(
      repo,
      deduction.id,
      { accept: true },
      tenant,
      new Request("http://localhost"),
      { requireStepUp: stepUpMock, enqueueOnchain: enqueueMock },
    );

    expect(responded.status).toBe("ACCEPTED");
    expect(stepUpMock).toHaveBeenCalledWith(expect.anything(), tenant.id, "RESPOND_DEDUCTION");

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("DEDUCTED");
    expect(deposit?.deducted_amount).toBe(1500000n);
    expect(deposit?.refund_amount).toBe(3500000n); // 5000000 - 1500000

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "respond_deduction",
        args: [contractId, true],
      }),
    );
  });

  it("tình huống lỗi 6: tenant rejects deduction: deduction REJECTED, deposit moves to PENDING_DISPUTE, dispute opened", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDeposit(repo);
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "2000000", reasonText: "Chi phí sơn lại nhà" },
      landlord,
    );

    const responded = await respondDeduction(repo, deduction.id, { accept: false }, tenant);

    expect(responded.status).toBe("REJECTED");

    // Deposit locked in PENDING_DISPUTE
    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_DISPUTE");

    // Dispute record opened
    const dispute = await repo.disputes.findByContractId(contractId);
    expect(dispute?.status).toBe("IN_PROGRESS");
    expect(dispute?.opened_by).toBe(tenant.id);
  });

  it("non-tenant cannot respond to deduction", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDeposit(repo);
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "1000000", reasonText: "Reason" },
      landlord,
    );

    await expect(respondDeduction(repo, deduction.id, { accept: true }, stranger)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
