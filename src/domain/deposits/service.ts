import { randomUUID } from "node:crypto";
import {
  assertDepositTransition,
  assertTransition,
  CONTRACT_TRANSITIONS,
  DEPOSIT_TRANSITIONS,
} from "@/domain/states";
import type { DepositDto, SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { domainI18n } from "@/i18n/sections/domain";
import type { DomainRepository, EnqueueOnchainFn, RequireStepUpFn } from "../repository";

export type DepositServiceDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
  requireStepUp?: RequireStepUpFn;
};

/**
 * Một bên (chủ nhà hoặc người thuê) gửi yêu cầu hoàn cọc.
 */
export async function requestRefund(
  repo: DomainRepository,
  contractId: string,
  user: SessionUser,
  deps?: DepositServiceDeps,
): Promise<DepositDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  const isParty =
    contract.landlord_id === user.id || contract.tenant_id === user.id || user.role === "ADMIN_DEMO";
  if (!isParty) throw new ApiError("FORBIDDEN");

  const deposit = await repo.deposits.findByContractId(contractId);
  if (!deposit) throw new ApiError("NOT_FOUND", undefined, domainI18n.deposits.notRecorded);

  const dispute = await repo.disputes.findByContractId(contractId);
  const disputeStatus = dispute?.status ?? "NONE";

  if (disputeStatus === "IN_PROGRESS" || disputeStatus === "AWAITING_CONFIRMATION") {
    throw new ApiError("DISPUTE_LOCKED", undefined, domainI18n.disputes.locked);
  }

  // Chuyển sang PENDING_REFUND
  if (deposit.status === "RECORDED") {
    assertTransition(DEPOSIT_TRANSITIONS, deposit.status, "PENDING_REFUND");
  } else if (deposit.status !== "PENDING_REFUND") {
    throw new ApiError("INVALID_TRANSITION");
  }

  const updatedDeposit = await repo.deposits.update(contractId, {
    status: "PENDING_REFUND",
  });

  const now = new Date().toISOString();

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "REFUND_REQUESTED",
    entity: "deposits",
    entity_id: contractId,
    meta: { requestedBy: user.id },
    created_at: now,
  });

  // Thông báo cho bên còn lại
  const otherPartyId = user.id === contract.landlord_id ? contract.tenant_id : contract.landlord_id;
  if (otherPartyId) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: otherPartyId,
      type: "REFUND_REQUESTED",
      title: "Yêu cầu hoàn trả cọc",
      body: "Đối tác đã gửi yêu cầu hoàn tiền cọc. Vui lòng xác nhận số tiền hoàn trả.",
      read_at: null,
      created_at: now,
    });
  }

  // Enqueue onchain: request_refund(id, party)
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "request_refund",
        args: [contractId],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue request_refund onchain:", err);
    }
  }

  return formatDepositDto(updatedDeposit);
}

export type ApproveRefundInput = {
  refundAmount: string;
};

/**
 * Phê duyệt hoàn cọc và xác nhận số tiền.
 * Cả hai bên cần gửi cùng số tiền mới được giải ngân.
 */
export async function approveRefund(
  repo: DomainRepository,
  contractId: string,
  input: ApproveRefundInput,
  user: SessionUser,
  request?: Request,
  deps?: DepositServiceDeps,
): Promise<DepositDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  const isLandlord = contract.landlord_id === user.id;
  const isTenant = contract.tenant_id === user.id;

  if (!isLandlord && !isTenant && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN");
  }

  // Step-up authentication bắt buộc khi phê duyệt hoàn cọc
  if (deps?.requireStepUp && request) {
    await deps.requireStepUp(request, user.id, "APPROVE_REFUND");
  }

  const deposit = await repo.deposits.findByContractId(contractId);
  if (!deposit) throw new ApiError("NOT_FOUND", undefined, domainI18n.deposits.notRecorded);

  const dispute = await repo.disputes.findByContractId(contractId);
  const disputeStatus = dispute?.status ?? "NONE";

  if (disputeStatus === "IN_PROGRESS" || disputeStatus === "AWAITING_CONFIRMATION") {
    throw new ApiError("DISPUTE_LOCKED", undefined, domainI18n.disputes.locked);
  }

  const submittedAmount = BigInt(input.refundAmount);
  if (submittedAmount < 0n || submittedAmount > deposit.paid_amount) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Số tiền hoàn trả không hợp lệ");
  }

  // Cập nhật số tiền mà bên này đồng ý
  const updates: Partial<typeof deposit> = {};
  if (isLandlord || user.role === "ADMIN_DEMO") {
    updates.landlord_refund_amount = submittedAmount;
  }
  if (isTenant) {
    updates.tenant_refund_amount = submittedAmount;
  }

  const now = new Date().toISOString();

  // Kiểm tra số tiền cả hai bên sau khi cập nhật
  const currentLandlordAmount = isLandlord ? submittedAmount : deposit.landlord_refund_amount;
  const currentTenantAmount = isTenant ? submittedAmount : deposit.tenant_refund_amount;

  // Trường hợp 1: Cả hai bên đã gửi và CÙNG SỐ TIỀN
  if (currentLandlordAmount !== null && currentTenantAmount !== null) {
    if (currentLandlordAmount === currentTenantAmount) {
      // Xác nhận hoàn cọc qua assertDepositTransition
      assertDepositTransition(deposit.status, "REFUNDED", disputeStatus);

      updates.status = "REFUNDED";
      updates.refund_amount = currentLandlordAmount;
      updates.deducted_amount = deposit.paid_amount - currentLandlordAmount;

      const updated = await repo.deposits.update(contractId, updates);

      // Nếu hợp đồng đang ACTIVE, chuyển sang ENDED
      if (contract.status === "ACTIVE") {
        assertTransition(CONTRACT_TRANSITIONS, contract.status, "ENDED");
        await repo.contracts.update(contractId, { status: "ENDED" });
      }

      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: user.id,
        action: "REFUND_COMPLETED",
        entity: "deposits",
        entity_id: contractId,
        meta: { agreedAmount: input.refundAmount },
        created_at: now,
      });

      // Thông báo cho cả 2 bên
      for (const uid of [contract.landlord_id, contract.tenant_id].filter(Boolean) as string[]) {
        await repo.notifications.create({
          id: randomUUID(),
          user_id: uid,
          type: "REFUND_COMPLETED",
          title: "Hoàn cọc thành công",
          body: `Đã thống nhất hoàn trả cọc số tiền ${input.refundAmount} ₫. Hợp đồng kết thúc.`,
          read_at: null,
          created_at: now,
        });
      }

      // Enqueue onchain: approve_refund(id, party, refund_amount)
      if (deps?.enqueueOnchain) {
        try {
          await deps.enqueueOnchain(repo, {
            contractId,
            action: "approve_refund",
            args: [contractId, input.refundAmount],
            signer: { kind: "USER", userId: user.id },
          });
        } catch (err) {
          console.error("[domain] Failed to enqueue approve_refund onchain:", err);
        }
      }

      return formatDepositDto(updated);
    } else {
      // Trường hợp 2: Bất đồng số tiền -> Tình huống lỗi 5 & 6
      // Chuyển sang PENDING_DISPUTE, khóa cọc, hệ thống KHÔNG tự giải ngân
      assertTransition(DEPOSIT_TRANSITIONS, deposit.status, "PENDING_DISPUTE");

      updates.status = "PENDING_DISPUTE";
      const updated = await repo.deposits.update(contractId, updates);

      if (dispute) {
        await repo.disputes.update(contractId, {
          status: "IN_PROGRESS",
          note: `Bất đồng số tiền hoàn cọc: Chủ nhà đề xuất ${currentLandlordAmount}, Người thuê đề xuất ${currentTenantAmount}`,
        });
      } else {
        await repo.disputes.create({
          contract_id: contractId,
          status: "IN_PROGRESS",
          opened_by: user.id,
          note: `Bất đồng số tiền hoàn cọc: Chủ nhà đề xuất ${currentLandlordAmount}, Người thuê đề xuất ${currentTenantAmount}`,
          landlord_agreed_amount: null,
          tenant_agreed_amount: null,
          created_at: now,
          updated_at: now,
        });
      }

      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: user.id,
        action: "DISPUTE_OPENED_DUE_TO_MISMATCH",
        entity: "deposits",
        entity_id: contractId,
        meta: {
          landlordAmount: currentLandlordAmount.toString(),
          tenantAmount: currentTenantAmount.toString(),
        },
        created_at: now,
      });

      // Enqueue onchain: open_dispute(id, party)
      if (deps?.enqueueOnchain) {
        try {
          await deps.enqueueOnchain(repo, {
            contractId,
            action: "open_dispute",
            args: [contractId],
            signer: { kind: "USER", userId: user.id },
          });
        } catch (err) {
          console.error("[domain] Failed to enqueue open_dispute onchain:", err);
        }
      }

      return formatDepositDto(updated);
    }
  }

  // Trường hợp 3: Mới chỉ có một bên gửi số tiền -> giữ PENDING_REFUND
  const updated = await repo.deposits.update(contractId, updates);

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "REFUND_APPROVED_ONE_PARTY",
    entity: "deposits",
    entity_id: contractId,
    meta: { party: isLandlord ? "LANDLORD" : "TENANT", amount: input.refundAmount },
    created_at: now,
  });

  const otherPartyId = isLandlord ? contract.tenant_id : contract.landlord_id;
  if (otherPartyId) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: otherPartyId,
      type: "REFUND_AWAITING_APPROVAL",
      title: "Chờ xác nhận số tiền hoàn cọc",
      body: `Bên kia đã đề xuất số tiền hoàn cọc ${input.refundAmount} ₫. Vui lòng xác nhận để hoàn tất.`,
      read_at: null,
      created_at: now,
    });
  }

  // Enqueue onchain: approve_refund cho bên đã gửi
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "approve_refund",
        args: [contractId, input.refundAmount],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue approve_refund onchain:", err);
    }
  }

  return formatDepositDto(updated);
}

function formatDepositDto(deposit: any): DepositDto {
  return {
    status: deposit.status,
    paidAmount: deposit.paid_amount.toString(),
    refundAmount: deposit.refund_amount.toString(),
    deductedAmount: deposit.deducted_amount.toString(),
    landlordRefundAmount: deposit.landlord_refund_amount?.toString() ?? null,
    tenantRefundAmount: deposit.tenant_refund_amount?.toString() ?? null,
  };
}
