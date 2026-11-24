import { describe, expect, it, vi } from "vitest";
import { openDispute, resolveDispute } from "@/domain/disputes/service";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository } from "@/domain/repository";

describe("domain disputes service", () => {
  const landlord: SessionUser = { id: "landlord-1", role: "LANDLORD", fullName: "Chủ nhà", phone: "0901" };
  const tenant: SessionUser = { id: "tenant-1", role: "TENANT", fullName: "Người thuê", phone: "0902" };

  async function setupDisputedContract(repo: FakeDomainRepository) {
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
      status: "PENDING_REFUND",
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

  it("either party can open a dispute, locking deposit into PENDING_DISPUTE", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDisputedContract(repo);

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-disp" });
    const dispute = await openDispute(repo, contractId, { note: "Không đồng ý mức trừ cọc" }, tenant, {
      enqueueOnchain: enqueueMock,
    });

    expect(dispute.status).toBe("IN_PROGRESS");
    expect(dispute.openedBy).toBe(tenant.id);

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_DISPUTE");

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "open_dispute" }),
    );
  });

  it("resolve dispute: 1 party submits -> AWAITING_CONFIRMATION, deposit remains locked", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDisputedContract(repo);
    await openDispute(repo, contractId, {}, tenant);

    const stepUpMock = vi.fn().mockResolvedValue(undefined);
    const res = await resolveDispute(
      repo,
      contractId,
      { agreedAmount: "3500000" },
      landlord,
      new Request("http://localhost"),
      { requireStepUp: stepUpMock },
    );

    expect(res.status).toBe("AWAITING_CONFIRMATION");
    expect(res.landlordAgreedAmount).toBe("3500000");
    expect(res.tenantAgreedAmount).toBeNull();
    expect(stepUpMock).toHaveBeenCalledWith(expect.anything(), landlord.id, "RESOLVE_DISPUTE");

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_DISPUTE");
  });

  it("resolve dispute: both parties submit SAME agreed amount -> RESOLVED and deposit released", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDisputedContract(repo);
    await openDispute(repo, contractId, {}, tenant);

    await resolveDispute(repo, contractId, { agreedAmount: "3500000" }, landlord);
    const res = await resolveDispute(repo, contractId, { agreedAmount: "3500000" }, tenant);

    expect(res.status).toBe("RESOLVED");
    expect(res.landlordAgreedAmount).toBe("3500000");
    expect(res.tenantAgreedAmount).toBe("3500000");

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("DEDUCTED"); // 3.5m refund, 1.5m deducted
    expect(deposit?.refund_amount).toBe(3500000n);
    expect(deposit?.deducted_amount).toBe(1500000n);

    const contract = await repo.contracts.findById(contractId);
    expect(contract?.status).toBe("ENDED");
  });

  it("tình huống lỗi 6: both parties submit DIFFERENT agreed amounts -> reverts to IN_PROGRESS, deposit remains locked", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupDisputedContract(repo);
    await openDispute(repo, contractId, {}, tenant);

    await resolveDispute(repo, contractId, { agreedAmount: "3000000" }, landlord);
    const res = await resolveDispute(repo, contractId, { agreedAmount: "4500000" }, tenant);

    expect(res.status).toBe("IN_PROGRESS");

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_DISPUTE"); // No release!
  });
});
