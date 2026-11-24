import { describe, expect, it, vi } from "vitest";
import {
  confirmContract,
  createContract,
  generateRentPeriods,
  getContractDetail,
  listContracts,
} from "@/domain/contracts/service";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository } from "@/domain/repository";

describe("domain contracts service", () => {
  const landlord: SessionUser = {
    id: "landlord-1",
    role: "LANDLORD",
    fullName: "Chủ nhà Nguyễn Văn A",
    phone: "0901234567",
  };

  const tenant: SessionUser = {
    id: "tenant-1",
    role: "TENANT",
    fullName: "Người thuê Trần Thị B",
    phone: "0987654321",
  };

  const stranger: SessionUser = {
    id: "stranger-1",
    role: "TENANT",
    fullName: "Người lạ",
    phone: "0911111111",
  };

  const createInput = {
    roomLabel: "P.302 Căn hộ dịch vụ",
    rentAmount: "6000000",
    depositAmount: "6000000",
    startDate: "2026-02-01",
    endDate: "2026-07-31",
    dueDay: 5,
    lateFeeBpsPerDay: 50,
    termsText: "Quy định tòa nhà và thanh toán đúng hạn.",
    tenantPhoneInvited: "0987654321",
  };

  it("landlord creates a contract successfully with initial state PENDING_CONFIRMATION", async () => {
    const repo = new FakeDomainRepository();
    await repo.profiles.create({
      id: landlord.id,
      phone: landlord.phone,
      full_name: landlord.fullName,
      role: landlord.role,
      created_at: new Date().toISOString(),
    });

    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-1" });

    const contract = await createContract(repo, createInput, landlord, {
      enqueueOnchain: enqueueMock,
    });

    expect(contract.id).toBeDefined();
    expect(contract.status).toBe("PENDING_CONFIRMATION");
    expect(contract.deposit.status).toBe("UNPAID");
    expect(contract.journeyStep).toBe("SIGN");
    expect(contract.rentPeriods.length).toBeGreaterThan(0);
    expect(contract.rentPeriods[0].status).toBe("AWAITING_PAYMENT");
    expect(contract.docHash).toBeDefined();

    // Outbox onchain was called with non-PII args
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const callArgs = enqueueMock.mock.calls[0][1];
    expect(callArgs.action).toBe("create_contract");
    // Ensure no PII in args
    expect(JSON.stringify(callArgs.args)).not.toContain("0987654321");
    expect(JSON.stringify(callArgs.args)).not.toContain("Nguyễn Văn A");
    expect(JSON.stringify(callArgs.args)).not.toContain("P.302");
  });

  it("non-landlord cannot create contract", async () => {
    const repo = new FakeDomainRepository();
    await expect(createContract(repo, createInput, tenant)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("validates invalid dueDay and dates", async () => {
    const repo = new FakeDomainRepository();
    await expect(createContract(repo, { ...createInput, dueDay: 35 }, landlord)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      createContract(repo, { ...createInput, startDate: "2026-05-01", endDate: "2026-01-01" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("tenant confirms contract and state transitions to ACTIVE", async () => {
    const repo = new FakeDomainRepository();
    await repo.profiles.create({
      id: tenant.id,
      phone: tenant.phone,
      full_name: tenant.fullName,
      role: tenant.role,
      created_at: new Date().toISOString(),
    });

    const contract = await createContract(repo, createInput, landlord);

    const stepUpMock = vi.fn().mockResolvedValue(undefined);
    const enqueueMock = vi.fn().mockResolvedValue({ id: "tx-2" });

    const confirmed = await confirmContract(repo, contract.id, tenant, new Request("http://localhost"), {
      requireStepUp: stepUpMock,
      enqueueOnchain: enqueueMock,
    });

    expect(confirmed.status).toBe("ACTIVE");
    expect(confirmed.journeyStep).toBe("DEPOSIT");
    expect(stepUpMock).toHaveBeenCalledWith(expect.anything(), tenant.id, "SIGN_CONTRACT");
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "tenant_confirm",
        signer: { kind: "USER", userId: tenant.id },
      }),
    );
  });

  it("stranger cannot confirm contract", async () => {
    const repo = new FakeDomainRepository();
    const contract = await createContract(repo, createInput, landlord);

    await expect(confirmContract(repo, contract.id, stranger)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot confirm an already ACTIVE contract (invalid transition)", async () => {
    const repo = new FakeDomainRepository();
    await repo.profiles.create({
      id: tenant.id,
      phone: tenant.phone,
      full_name: tenant.fullName,
      role: tenant.role,
      created_at: new Date().toISOString(),
    });

    const contract = await createContract(repo, createInput, landlord);
    await confirmContract(repo, contract.id, tenant);

    await expect(confirmContract(repo, contract.id, tenant)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("getContractDetail verifies authorization", async () => {
    const repo = new FakeDomainRepository();
    const contract = await createContract(repo, createInput, landlord);

    // Landlord can read
    const detail = await getContractDetail(repo, contract.id, landlord);
    expect(detail.id).toBe(contract.id);

    // Stranger cannot read
    await expect(getContractDetail(repo, contract.id, stranger)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("listContracts lists only contracts involving the user", async () => {
    const repo = new FakeDomainRepository();
    const c1 = await createContract(repo, createInput, landlord);
    const list = await listContracts(repo, landlord);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(c1.id);

    const strangerList = await listContracts(repo, stranger);
    expect(strangerList.length).toBe(0);
  });

  it("handles due_day = 31 correctly across short months without spilling", () => {
    const periods = generateRentPeriods(
      "contract-31",
      "2026-01-01",
      "2026-06-30",
      31,
      5000000n,
      new Date().toISOString(),
    );
    expect(periods.length).toBe(6);
    expect(periods[0].due_date).toBe("2026-01-31");
    expect(periods[1].due_date).toBe("2026-02-28"); // Feb capped at 28
    expect(periods[2].due_date).toBe("2026-03-31");
    expect(periods[3].due_date).toBe("2026-04-30"); // Apr capped at 30
    expect(periods[4].due_date).toBe("2026-05-31");
    expect(periods[5].due_date).toBe("2026-06-30"); // Jun capped at 30
  });
});
