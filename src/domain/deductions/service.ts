import { randomUUID } from "node:crypto";
import {
  assertDepositTransition,
  assertTransition,
  DEDUCTION_TRANSITIONS,
  DEPOSIT_TRANSITIONS,
} from "@/domain/states";
import type { DeductionDto, SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { domainI18n } from "@/i18n/sections/domain";
import { hashReason, newSalt } from "../hashing";
import type { DomainRepository, EnqueueOnchainFn, RequireStepUpFn } from "../repository";
import type { DeductionEntity } from "../types";

export type DeductionServiceDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
  requireStepUp?: RequireStepUpFn;
};

export type ProposeDeductionInput = {
  amount: string;
  reasonText: string;
};

/**
 * Chủ nhà đề xuất khấu trừ tiền cọc.
 */
export async function proposeDeduction(
  repo: DomainRepository,
  contractId: string,
  input: ProposeDeductionInput,
  user: SessionUser,
  deps?: DeductionServiceDeps,
): Promise<DeductionDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  if (contract.landlord_id !== user.id && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN", undefined, "Chỉ chủ nhà mới có quyền đề xuất khấu trừ cọc.");
  }

  const deposit = await repo.deposits.findByContractId(contractId);
  if (!deposit) throw new ApiError("NOT_FOUND", undefined, domainI18n.deposits.notRecorded);

  const dispute = await repo.disputes.findByContractId(contractId);
  const disputeStatus = dispute?.status ?? "NONE";

  if (disputeStatus === "IN_PROGRESS" || disputeStatus === "AWAITING_CONFIRMATION") {
    throw new ApiError("DISPUTE_LOCKED", undefined, domainI18n.disputes.locked);
  }

  const amountBig = BigInt(input.amount);
  if (amountBig <= 0n || amountBig > deposit.paid_amount) {
    throw new ApiError("VALIDATION_ERROR", undefined, domainI18n.deductions.exceedsDeposit);
  }

  // Nếu cọc đang ở RECORDED, chuyển sang PENDING_REFUND
  if (deposit.status === "RECORDED") {
    assertTransition(DEPOSIT_TRANSITIONS, deposit.status, "PENDING_REFUND");
    await repo.deposits.update(contractId, { status: "PENDING_REFUND" });
  } else if (deposit.status !== "PENDING_REFUND") {
    throw new ApiError("INVALID_TRANSITION");
  }

  const deductionId = randomUUID();
  const reasonSalt = newSalt();
  const reasonHash = hashReason(input.reasonText, reasonSalt);
  const now = new Date().toISOString();

  const deductionEntity: DeductionEntity = {
    id: deductionId,
    contract_id: contractId,
    amount: amountBig,
    reason_text: input.reasonText,
    reason_salt: reasonSalt,
    reason_hash: reasonHash,
    status: "PROPOSED",
    created_at: now,
    updated_at: now,
  };

  await repo.deductions.create(deductionEntity);

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "DEDUCTION_PROPOSED",
    entity: "deduction_requests",
    entity_id: deductionId,
    meta: {
      contractId,
      amount: input.amount,
      reasonHash,
    },
    created_at: now,
  });

  if (contract.tenant_id) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.tenant_id,
      type: "DEDUCTION_PROPOSED",
      title: "Đề xuất khấu trừ cọc mới",
      body: `Chủ nhà đề xuất khấu trừ ${input.amount} ₫ từ tiền cọc. Lý do: ${input.reasonText}`,
      read_at: null,
      created_at: now,
    });
  }

  // Enqueue onchain: propose_deduction(id, landlord, amount, reason_hash)
  // Cấm PII: không gửi reason_text trần lên chain, chỉ gửi reason_hash!
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "propose_deduction",
        args: [contractId, input.amount, reasonHash],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue propose_deduction onchain:", err);
    }
  }

  return {
    id: deductionEntity.id,
    amount: deductionEntity.amount.toString(),
    reasonText: deductionEntity.reason_text,
    status: deductionEntity.status,
    createdAt: deductionEntity.created_at,
  };
}

export type RespondDeductionInput = {
  accept: boolean;
};

/**
 * Người thuê phản hồi đề xuất khấu trừ (Chấp nhận hoặc Từ chối).
 */
export async function respondDeduction(
  repo: DomainRepository,
  deductionId: string,
  input: RespondDeductionInput,
  user: SessionUser,
  request?: Request,
  deps?: DeductionServiceDeps,
): Promise<DeductionDto> {
  const deduction = await repo.deductions.findById(deductionId);
  if (!deduction) throw new ApiError("NOT_FOUND", undefined, domainI18n.deductions.notFound);

  const contract = await repo.contracts.findById(deduction.contract_id);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  if (contract.tenant_id !== user.id && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN", undefined, "Chỉ người thuê mới có quyền phản hồi khấu trừ.");
  }

  // Step-up authentication bắt buộc khi phản hồi khấu trừ
  if (deps?.requireStepUp && request) {
    await deps.requireStepUp(request, user.id, "RESPOND_DEDUCTION");
  }

  const deposit = await repo.deposits.findByContractId(contract.id);
  if (!deposit) throw new ApiError("NOT_FOUND", undefined, domainI18n.deposits.notRecorded);

  const dispute = await repo.disputes.findByContractId(contract.id);
  const disputeStatus = dispute?.status ?? "NONE";

  if (disputeStatus === "IN_PROGRESS" || disputeStatus === "AWAITING_CONFIRMATION") {
    throw new ApiError("DISPUTE_LOCKED", undefined, domainI18n.disputes.locked);
  }

  const now = new Date().toISOString();

  if (input.accept) {
    // 1. Chấp nhận khấu trừ
    assertTransition(DEDUCTION_TRANSITIONS, deduction.status, "ACCEPTED");
    const updatedDeduction = await repo.deductions.update(deductionId, { status: "ACCEPTED" });

    // Tính tiền hoàn cọc còn lại sau khấu trừ
    const remainingRefund = deposit.paid_amount - deduction.amount;

    // Chuyển trạng thái cọc sang DEDUCTED qua assertDepositTransition
    assertDepositTransition(deposit.status, "DEDUCTED", disputeStatus);

    await repo.deposits.update(contract.id, {
      status: "DEDUCTED",
      deducted_amount: deduction.amount,
      refund_amount: remainingRefund,
    });

    await repo.auditLogs.create({
      id: randomUUID(),
      actor_id: user.id,
      action: "DEDUCTION_ACCEPTED",
      entity: "deduction_requests",
      entity_id: deductionId,
      meta: {
        contractId: contract.id,
        deductedAmount: deduction.amount.toString(),
        remainingRefund: remainingRefund.toString(),
      },
      created_at: now,
    });

    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.landlord_id,
      type: "DEDUCTION_ACCEPTED",
      title: "Người thuê đã chấp nhận khấu trừ",
      body: `Người thuê đã đồng ý khấu trừ ${deduction.amount.toString()} ₫. Số cọc còn lại: ${remainingRefund.toString()} ₫.`,
      read_at: null,
      created_at: now,
    });

    // Enqueue onchain: respond_deduction(id, tenant, true)
    if (deps?.enqueueOnchain) {
      try {
        await deps.enqueueOnchain(repo, {
          contractId: contract.id,
          action: "respond_deduction",
          args: [contract.id, true],
          signer: { kind: "USER", userId: user.id },
        });
      } catch (err) {
        console.error("[domain] Failed to enqueue respond_deduction onchain:", err);
      }
    }

    return {
      id: updatedDeduction.id,
      amount: updatedDeduction.amount.toString(),
      reasonText: updatedDeduction.reason_text,
      status: updatedDeduction.status,
      createdAt: updatedDeduction.created_at,
    };
  } else {
    // 2. Từ chối khấu trừ -> Tình huống lỗi 6!
    // Hai bên không thống nhất -> PENDING_DISPUTE, khóa cọc, không tự kết luận.
    assertTransition(DEDUCTION_TRANSITIONS, deduction.status, "REJECTED");
    const updatedDeduction = await repo.deductions.update(deductionId, { status: "REJECTED" });

    assertTransition(DEPOSIT_TRANSITIONS, deposit.status, "PENDING_DISPUTE");
    await repo.deposits.update(contract.id, { status: "PENDING_DISPUTE" });

    if (dispute) {
      await repo.disputes.update(contract.id, {
        status: "IN_PROGRESS",
        note: `Người thuê từ chối khấu trừ ${deduction.amount.toString()} ₫`,
      });
    } else {
      await repo.disputes.create({
        contract_id: contract.id,
        status: "IN_PROGRESS",
        opened_by: user.id,
        note: `Người thuê từ chối khấu trừ ${deduction.amount.toString()} ₫`,
        landlord_agreed_amount: null,
        tenant_agreed_amount: null,
        created_at: now,
        updated_at: now,
      });
    }

    await repo.auditLogs.create({
      id: randomUUID(),
      actor_id: user.id,
      action: "DEDUCTION_REJECTED_DISPUTE_OPENED",
      entity: "deduction_requests",
      entity_id: deductionId,
      meta: { contractId: contract.id, rejectedAmount: deduction.amount.toString() },
      created_at: now,
    });

    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.landlord_id,
      type: "DEDUCTION_REJECTED",
      title: "Người thuê từ chối khấu trừ",
      body: `Người thuê đã từ chối khấu trừ cọc. Hợp đồng chuyển sang trạng thái tranh chấp.`,
      read_at: null,
      created_at: now,
    });

    // Enqueue onchain: respond_deduction(id, tenant, false) và open_dispute(id, party)
    if (deps?.enqueueOnchain) {
      try {
        await deps.enqueueOnchain(repo, {
          contractId: contract.id,
          action: "respond_deduction",
          args: [contract.id, false],
          signer: { kind: "USER", userId: user.id },
        });
        await deps.enqueueOnchain(repo, {
          contractId: contract.id,
          action: "open_dispute",
          args: [contract.id],
          signer: { kind: "USER", userId: user.id },
        });
      } catch (err) {
        console.error("[domain] Failed to enqueue onchain for deduction rejection:", err);
      }
    }

    return {
      id: updatedDeduction.id,
      amount: updatedDeduction.amount.toString(),
      reasonText: updatedDeduction.reason_text,
      status: updatedDeduction.status,
      createdAt: updatedDeduction.created_at,
    };
  }
}
