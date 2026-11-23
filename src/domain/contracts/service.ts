import { randomUUID } from "node:crypto";
import { assertTransition, CONTRACT_TRANSITIONS } from "@/domain/states";
import type { ContractDetailDto, ContractSummaryDto, SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { domainI18n } from "@/i18n/sections/domain";
import { canonicalizeContract, hashContract, newSalt } from "../hashing";
import type { DomainRepository, EnqueueOnchainFn, RequireStepUpFn } from "../repository";
import { computeJourneyStep, type ContractEntity, type DepositEntity, type RentPeriodEntity } from "../types";

export type CreateContractInput = {
  roomLabel: string;
  rentAmount: string;
  depositAmount: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dueDay: number;
  lateFeeBpsPerDay: number;
  termsText: string;
  tenantPhoneInvited?: string | null;
  tenantId?: string | null;
};

export type ContractServiceDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
  requireStepUp?: RequireStepUpFn;
};

/**
 * Tạo hợp đồng thuê nhà mới (chỉ dành cho Chủ nhà).
 */
export async function createContract(
  repo: DomainRepository,
  input: CreateContractInput,
  user: SessionUser,
  deps?: ContractServiceDeps,
): Promise<ContractDetailDto> {
  if (user.role !== "LANDLORD" && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN", undefined, domainI18n.contracts.unauthorizedRole);
  }

  const rentAmountBig = BigInt(input.rentAmount);
  const depositAmountBig = BigInt(input.depositAmount);

  if (rentAmountBig <= 0n || depositAmountBig <= 0n) {
    throw new ApiError("VALIDATION_ERROR", undefined, domainI18n.contracts.invalidAmounts);
  }
  if (input.dueDay < 1 || input.dueDay > 31) {
    throw new ApiError("VALIDATION_ERROR", undefined, domainI18n.contracts.invalidDueDay);
  }
  if (input.startDate >= input.endDate) {
    throw new ApiError("VALIDATION_ERROR", undefined, domainI18n.contracts.invalidDates);
  }

  const contractId = randomUUID();
  const docSalt = newSalt();

  const docHash = hashContract(
    {
      contract_id: contractId,
      room_label: input.roomLabel,
      rent_amount: input.rentAmount,
      deposit_amount: input.depositAmount,
      start_date: input.startDate,
      end_date: input.endDate,
      due_day: input.dueDay,
      late_fee_bps_per_day: input.lateFeeBpsPerDay,
      terms_text: input.termsText,
    },
    docSalt,
  );

  const now = new Date().toISOString();

  // Tìm thông tin người thuê nếu có số điện thoại được mời
  let resolvedTenantId = input.tenantId ?? null;
  if (!resolvedTenantId && input.tenantPhoneInvited) {
    const tenantProfile = await repo.profiles.findByPhone(input.tenantPhoneInvited);
    if (tenantProfile) resolvedTenantId = tenantProfile.id;
  }

  const contractEntity: ContractEntity = {
    id: contractId,
    landlord_id: user.id,
    tenant_id: resolvedTenantId,
    tenant_phone_invited: input.tenantPhoneInvited ?? null,
    room_label: input.roomLabel,
    rent_amount: rentAmountBig,
    deposit_amount: depositAmountBig,
    start_date: input.startDate,
    end_date: input.endDate,
    due_day: input.dueDay,
    late_fee_bps_per_day: input.lateFeeBpsPerDay,
    terms_text: input.termsText,
    doc_hash: docHash,
    doc_salt: docSalt,
    status: "PENDING_CONFIRMATION",
    onchain_ref: null,
    created_at: now,
    updated_at: now,
  };

  const depositEntity: DepositEntity = {
    contract_id: contractId,
    status: "UNPAID",
    paid_amount: 0n,
    refund_amount: 0n,
    deducted_amount: 0n,
    landlord_refund_amount: null,
    tenant_refund_amount: null,
    created_at: now,
    updated_at: now,
  };

  const rentPeriods = generateRentPeriods(
    contractId,
    input.startDate,
    input.endDate,
    input.dueDay,
    rentAmountBig,
    now,
  );

  await repo.contracts.create(contractEntity);
  await repo.deposits.create(depositEntity);
  await repo.rentPeriods.createMany(rentPeriods);

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "CONTRACT_CREATED",
    entity: "rental_contracts",
    entity_id: contractId,
    meta: {
      roomLabel: input.roomLabel,
      rentAmount: input.rentAmount,
      depositAmount: input.depositAmount,
      docHash,
    },
    created_at: now,
  });

  if (resolvedTenantId) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: resolvedTenantId,
      type: "CONTRACT_INVITED",
      title: "Lời mời thuê nhà mới",
      body: `Bạn nhận được hợp đồng thuê phòng ${input.roomLabel}. Vui lòng kiểm tra và xác nhận.`,
      read_at: null,
      created_at: now,
    });
  }

  // Ghi onchain outbox: create_contract(id, landlord, tenant, doc_hash, deposit, rent, due_day, late_fee_bps_per_day)
  // Quy tắc: args KHÔNG chứa PII (không tên, không SĐT, không địa chỉ, không room_label).
  // Lỗi onchain không làm hỏng trạng thái off-chain.
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "create_contract",
        args: [
          contractId,
          docHash,
          input.depositAmount,
          input.rentAmount,
          input.dueDay,
          input.lateFeeBpsPerDay,
        ],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue create_contract onchain:", err);
    }
  }

  return assembleContractDetail(
    contractEntity,
    depositEntity,
    rentPeriods,
    [],
    null,
    user.id,
    await repo.profiles.findById(user.id),
    resolvedTenantId ? await repo.profiles.findById(resolvedTenantId) : null,
  );
}

/**
 * Người thuê xác nhận hợp đồng.
 */
export async function confirmContract(
  repo: DomainRepository,
  contractId: string,
  user: SessionUser,
  request?: Request,
  deps?: ContractServiceDeps,
): Promise<ContractDetailDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  // Kiểm tra quyền: người thuê được chỉ định qua tenant_id hoặc phone
  const userProfile = await repo.profiles.findById(user.id);
  const isTargetTenant =
    contract.tenant_id === user.id ||
    (contract.tenant_id === null &&
      (!contract.tenant_phone_invited ||
        contract.tenant_phone_invited === userProfile?.phone ||
        contract.tenant_phone_invited === user.phone));

  if (!isTargetTenant && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN", undefined, domainI18n.contracts.invalidTenant);
  }

  // Đổi trạng thái qua bảng chuyển hợp lệ
  assertTransition(CONTRACT_TRANSITIONS, contract.status, "ACTIVE");

  // Step-up authentication bắt buộc cho ký hợp đồng
  if (deps?.requireStepUp && request) {
    await deps.requireStepUp(request, user.id, "SIGN_CONTRACT");
  }

  const updatedContract = await repo.contracts.update(contractId, {
    status: "ACTIVE",
    tenant_id: user.id,
  });

  const now = new Date().toISOString();

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "CONTRACT_CONFIRMED",
    entity: "rental_contracts",
    entity_id: contractId,
    meta: { previousStatus: contract.status, newStatus: "ACTIVE" },
    created_at: now,
  });

  await repo.notifications.create({
    id: randomUUID(),
    user_id: contract.landlord_id,
    type: "CONTRACT_CONFIRMED",
    title: "Hợp đồng đã được xác nhận",
    body: `Người thuê đã xác nhận hợp đồng phòng ${contract.room_label}. Hợp đồng hiện có hiệu lực.`,
    read_at: null,
    created_at: now,
  });

  // Ghi onchain: tenant_confirm(id, tenant)
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "tenant_confirm",
        args: [contractId],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue tenant_confirm onchain:", err);
    }
  }

  const [deposit, periods, deductions, dispute, landlordProfile] = await Promise.all([
    repo.deposits.findByContractId(contractId),
    repo.rentPeriods.listByContractId(contractId),
    repo.deductions.listByContractId(contractId),
    repo.disputes.findByContractId(contractId),
    repo.profiles.findById(contract.landlord_id),
  ]);

  return assembleContractDetail(
    updatedContract,
    deposit!,
    periods,
    deductions,
    dispute,
    user.id,
    landlordProfile,
    userProfile,
  );
}

/**
 * Lấy chi tiết hợp đồng và các thực thể liên quan.
 */
export async function getContractDetail(
  repo: DomainRepository,
  contractId: string,
  user: SessionUser,
): Promise<ContractDetailDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  const isParty =
    contract.landlord_id === user.id ||
    contract.tenant_id === user.id ||
    user.role === "ADMIN_DEMO" ||
    (contract.tenant_id === null && contract.tenant_phone_invited === user.phone);

  if (!isParty) {
    throw new ApiError("FORBIDDEN");
  }

  const [deposit, periods, deductions, dispute, landlordProfile, tenantProfile] = await Promise.all([
    repo.deposits.findByContractId(contractId),
    repo.rentPeriods.listByContractId(contractId),
    repo.deductions.listByContractId(contractId),
    repo.disputes.findByContractId(contractId),
    repo.profiles.findById(contract.landlord_id),
    contract.tenant_id ? repo.profiles.findById(contract.tenant_id) : null,
  ]);

  return assembleContractDetail(
    contract,
    deposit!,
    periods,
    deductions,
    dispute,
    user.id,
    landlordProfile,
    tenantProfile,
  );
}

/**
 * Danh sách hợp đồng của người dùng (tóm tắt).
 */
export async function listContracts(
  repo: DomainRepository,
  user: SessionUser,
): Promise<ContractSummaryDto[]> {
  const contracts = await repo.contracts.listByUserId(user.id);

  const results: ContractSummaryDto[] = [];
  for (const c of contracts) {
    const [deposit, dispute, landlordProfile, tenantProfile] = await Promise.all([
      repo.deposits.findByContractId(c.id),
      repo.disputes.findByContractId(c.id),
      repo.profiles.findById(c.landlord_id),
      c.tenant_id ? repo.profiles.findById(c.tenant_id) : null,
    ]);

    const depositStatus = deposit?.status ?? "UNPAID";
    const disputeStatus = dispute?.status ?? "NONE";
    const myRole = c.landlord_id === user.id ? "LANDLORD" : "TENANT";

    results.push({
      id: c.id,
      roomLabel: c.room_label,
      landlordName: landlordProfile?.full_name ?? null,
      tenantName: tenantProfile?.full_name ?? null,
      rentAmount: c.rent_amount.toString(),
      depositAmount: c.deposit_amount.toString(),
      startDate: c.start_date,
      endDate: c.end_date,
      dueDay: c.due_day,
      status: c.status,
      depositStatus,
      disputeStatus,
      journeyStep: computeJourneyStep(c.status, depositStatus, disputeStatus),
      myRole,
    });
  }

  return results;
}

/**
 * Sinh danh sách các kỳ thuê theo start_date, end_date và due_day.
 */
function generateRentPeriods(
  contractId: string,
  startDateStr: string,
  endDateStr: string,
  dueDay: number,
  amountDue: bigint,
  nowIso: string,
): RentPeriodEntity[] {
  const periods: RentPeriodEntity[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth(); // 0-indexed
  let periodNo = 1;

  while (true) {
    const monthDueDate = new Date(currentYear, currentMonth, dueDay);
    // Nếu ngày đến hạn đã vượt quá ngày kết thúc hợp đồng, dừng
    if (monthDueDate > end && periodNo > 1) break;

    const yyyy = currentYear.toString();
    const mm = String(currentMonth + 1).padStart(2, "0");
    const dd = String(Math.min(dueDay, daysInMonth(currentYear, currentMonth + 1))).padStart(2, "0");
    const dueDate = `${yyyy}-${mm}-${dd}`;

    periods.push({
      contract_id: contractId,
      period_no: periodNo,
      due_date: dueDate,
      amount_due: amountDue,
      amount_paid: 0n,
      late_days: 0,
      late_fee: 0n,
      status: periodNo === 1 ? "AWAITING_PAYMENT" : "NOT_DUE",
      created_at: nowIso,
      updated_at: nowIso,
    });

    periodNo++;
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }

    if (new Date(currentYear, currentMonth, 1) > end) break;
  }

  return periods;
}

function daysInMonth(year: number, month1Indexed: number): number {
  return new Date(year, month1Indexed, 0).getDate();
}

function assembleContractDetail(
  contract: ContractEntity,
  deposit: DepositEntity,
  periods: RentPeriodEntity[],
  deductions: any[],
  dispute: any,
  currentUserId: string,
  landlordProfile: any,
  tenantProfile: any,
): ContractDetailDto {
  const depositStatus = deposit.status;
  const disputeStatus = dispute?.status ?? "NONE";
  const myRole = contract.landlord_id === currentUserId ? "LANDLORD" : "TENANT";

  return {
    id: contract.id,
    roomLabel: contract.room_label,
    landlordName: landlordProfile?.full_name ?? null,
    tenantName: tenantProfile?.full_name ?? null,
    rentAmount: contract.rent_amount.toString(),
    depositAmount: contract.deposit_amount.toString(),
    startDate: contract.start_date,
    endDate: contract.end_date,
    dueDay: contract.due_day,
    status: contract.status,
    depositStatus,
    disputeStatus,
    journeyStep: computeJourneyStep(contract.status, depositStatus, disputeStatus),
    myRole,
    lateFeeBpsPerDay: contract.late_fee_bps_per_day,
    termsText: contract.terms_text,
    docHash: contract.doc_hash,
    deposit: {
      status: deposit.status,
      paidAmount: deposit.paid_amount.toString(),
      refundAmount: deposit.refund_amount.toString(),
      deductedAmount: deposit.deducted_amount.toString(),
      landlordRefundAmount: deposit.landlord_refund_amount?.toString() ?? null,
      tenantRefundAmount: deposit.tenant_refund_amount?.toString() ?? null,
    },
    rentPeriods: periods.map((p) => ({
      periodNo: p.period_no,
      dueDate: p.due_date,
      amountDue: p.amount_due.toString(),
      amountPaid: p.amount_paid.toString(),
      lateDays: p.late_days,
      lateFee: p.late_fee.toString(),
      status: p.status,
    })),
    deductions: deductions.map((d) => ({
      id: d.id,
      amount: d.amount.toString(),
      reasonText: d.reason_text,
      status: d.status,
      createdAt: d.created_at,
    })),
    dispute: dispute
      ? {
          status: dispute.status,
          openedBy: dispute.opened_by,
          note: dispute.note,
          landlordAgreedAmount: dispute.landlord_agreed_amount?.toString() ?? null,
          tenantAgreedAmount: dispute.tenant_agreed_amount?.toString() ?? null,
        }
      : null,
  };
}
