import { randomUUID } from "node:crypto";
import {
  assertDepositTransition,
  assertTransition,
  CONTRACT_TRANSITIONS,
  DEPOSIT_TRANSITIONS,
  DISPUTE_TRANSITIONS,
} from "@/domain/states";
import type { DisputeDto, SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { domainI18n } from "@/i18n/sections/domain";
import type { DomainRepository, EnqueueOnchainFn, RequireStepUpFn } from "../repository";

export type DisputeServiceDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
  requireStepUp?: RequireStepUpFn;
};

export type OpenDisputeInput = {
  note?: string;
};

/**
 * Một bên mở tranh chấp khi có bất đồng.
 * Cọc chuyển sang PENDING_DISPUTE và bị khóa, không tự ý giải ngân.
 */
export async function openDispute(
  repo: DomainRepository,
  contractId: string,
  input: OpenDisputeInput,
  user: SessionUser,
  deps?: DisputeServiceDeps,
): Promise<DisputeDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  const isLandlord = contract.landlord_id === user.id;
  const isTenant = contract.tenant_id === user.id;

  if (!isLandlord && !isTenant && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN");
  }

  const deposit = await repo.deposits.findByContractId(contractId);
  if (!deposit) throw new ApiError("NOT_FOUND", undefined, domainI18n.deposits.notRecorded);

  // Đổi trạng thái cọc sang PENDING_DISPUTE
  assertTransition(DEPOSIT_TRANSITIONS, deposit.status, "PENDING_DISPUTE");
  await repo.deposits.update(contractId, { status: "PENDING_DISPUTE" });

  const existingDispute = await repo.disputes.findByContractId(contractId);
  const now = new Date().toISOString();

  let disputeEntity;
  if (existingDispute) {
    if (existingDispute.status === "NONE") {
      assertTransition(DISPUTE_TRANSITIONS, existingDispute.status, "IN_PROGRESS");
    }
    disputeEntity = await repo.disputes.update(contractId, {
      status: "IN_PROGRESS",
      opened_by: user.id,
      note: input.note ?? existingDispute.note,
    });
  } else {
    disputeEntity = await repo.disputes.create({
      contract_id: contractId,
      status: "IN_PROGRESS",
      opened_by: user.id,
      note: input.note ?? null,
      landlord_agreed_amount: null,
      tenant_agreed_amount: null,
      created_at: now,
      updated_at: now,
    });
  }

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "DISPUTE_OPENED",
    entity: "disputes",
    entity_id: contractId,
    meta: { openedBy: user.id, note: input.note },
    created_at: now,
  });

  const otherPartyId = isLandlord ? contract.tenant_id : contract.landlord_id;
  if (otherPartyId) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: otherPartyId,
      type: "DISPUTE_OPENED",
      title: "Tranh chấp đã được mở",
      body: domainI18n.disputes.opened,
      read_at: null,
      created_at: now,
    });
  }

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

  return formatDisputeDto(disputeEntity);
}

export type ResolveDisputeInput = {
  agreedAmount: string;
};

/**
 * Hai bên gửi số tiền thống nhất để giải quyết tranh chấp.
 * Chỉ chuyển sang RESOLVED và giải ngân khi CẢ HAI BÊN cùng gửi CÙNG SỐ TIỀN.
 */
export async function resolveDispute(
  repo: DomainRepository,
  contractId: string,
  input: ResolveDisputeInput,
  user: SessionUser,
  request?: Request,
  deps?: DisputeServiceDeps,
): Promise<DisputeDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND", undefined, domainI18n.contracts.notFound);

  const isLandlord = contract.landlord_id === user.id;
  const isTenant = contract.tenant_id === user.id;

  if (!isLandlord && !isTenant && user.role !== "ADMIN_DEMO") {
    throw new ApiError("FORBIDDEN");
  }

  // Step-up authentication bắt buộc khi giải quyết tranh chấp
  if (deps?.requireStepUp && request) {
    await deps.requireStepUp(request, user.id, "RESOLVE_DISPUTE");
  }

  const dispute = await repo.disputes.findByContractId(contractId);
  if (!dispute || (dispute.status !== "IN_PROGRESS" && dispute.status !== "AWAITING_CONFIRMATION")) {
    throw new ApiError("INVALID_TRANSITION", undefined, "Tranh chấp không ở trạng thái có thể giải quyết.");
  }

  const deposit = await repo.deposits.findByContractId(contractId);
  if (!deposit) throw new ApiError("NOT_FOUND", undefined, domainI18n.deposits.notRecorded);

  const submittedAmount = BigInt(input.agreedAmount);
  if (submittedAmount < 0n || submittedAmount > deposit.paid_amount) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Số tiền thống nhất không hợp lệ.");
  }

  const updates: Partial<typeof dispute> = {};
  if (isLandlord || user.role === "ADMIN_DEMO") {
    updates.landlord_agreed_amount = submittedAmount;
  }
  if (isTenant) {
    updates.tenant_agreed_amount = submittedAmount;
  }

  const now = new Date().toISOString();

  const currentLandlord = isLandlord ? submittedAmount : dispute.landlord_agreed_amount;
  const currentTenant = isTenant ? submittedAmount : dispute.tenant_agreed_amount;

  // Nếu cả hai bên đã gửi số tiền
  if (currentLandlord !== null && currentTenant !== null) {
    if (currentLandlord === currentTenant) {
      // 1. CẢ HAI BÊN CÙNG SỐ TIỀN -> Thống nhất thành công!
      assertTransition(DISPUTE_TRANSITIONS, dispute.status, "RESOLVED");
      updates.status = "RESOLVED";

      const updatedDispute = await repo.disputes.update(contractId, updates);

      // Giải ngân cọc qua assertDepositTransition (lúc này dispute === "RESOLVED")
      const remainingDeducted = deposit.paid_amount - currentLandlord;
      const targetDepositStatus = remainingDeducted > 0n ? "DEDUCTED" : "REFUNDED";

      assertDepositTransition("PENDING_DISPUTE", targetDepositStatus, "RESOLVED");

      await repo.deposits.update(contractId, {
        status: targetDepositStatus,
        refund_amount: currentLandlord,
        deducted_amount: remainingDeducted,
      });

      if (contract.status === "ACTIVE") {
        assertTransition(CONTRACT_TRANSITIONS, contract.status, "ENDED");
        await repo.contracts.update(contractId, { status: "ENDED" });
      }

      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: user.id,
        action: "DISPUTE_RESOLVED",
        entity: "disputes",
        entity_id: contractId,
        meta: { agreedAmount: input.agreedAmount },
        created_at: now,
      });

      for (const uid of [contract.landlord_id, contract.tenant_id].filter(Boolean) as string[]) {
        await repo.notifications.create({
          id: randomUUID(),
          user_id: uid,
          type: "DISPUTE_RESOLVED",
          title: "Tranh chấp đã được giải quyết",
          body: `Hai bên đã thống nhất giải quyết tranh chấp với số tiền ${input.agreedAmount} ₫.`,
          read_at: null,
          created_at: now,
        });
      }

      // Enqueue onchain: resolve_dispute(id, party, agreed_amount)
      if (deps?.enqueueOnchain) {
        try {
          await deps.enqueueOnchain(repo, {
            contractId,
            action: "resolve_dispute",
            args: [contractId, input.agreedAmount],
            signer: { kind: "USER", userId: user.id },
          });
        } catch (err) {
          console.error("[domain] Failed to enqueue resolve_dispute onchain:", err);
        }
      }

      return formatDisputeDto(updatedDispute);
    } else {
      // 2. HAI BÊN GỬI SỐ KHÁC NHAU -> Quay lại IN_PROGRESS, KHÔNG giải ngân!
      if (dispute.status === "AWAITING_CONFIRMATION") {
        assertTransition(DISPUTE_TRANSITIONS, dispute.status, "IN_PROGRESS");
      }
      updates.status = "IN_PROGRESS";
      const updatedDispute = await repo.disputes.update(contractId, updates);

      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: user.id,
        action: "DISPUTE_RESOLUTION_MISMATCH",
        entity: "disputes",
        entity_id: contractId,
        meta: {
          landlordAgreedAmount: currentLandlord.toString(),
          tenantAgreedAmount: currentTenant.toString(),
        },
        created_at: now,
      });

      return formatDisputeDto(updatedDispute);
    }
  }

  // 3. Mới chỉ có 1 bên gửi số tiền -> chuyển sang AWAITING_CONFIRMATION
  if (dispute.status === "IN_PROGRESS") {
    assertTransition(DISPUTE_TRANSITIONS, dispute.status, "AWAITING_CONFIRMATION");
  }
  updates.status = "AWAITING_CONFIRMATION";
  const updatedDispute = await repo.disputes.update(contractId, updates);

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "DISPUTE_RESOLUTION_SUBMITTED_ONE_PARTY",
    entity: "disputes",
    entity_id: contractId,
    meta: { party: isLandlord ? "LANDLORD" : "TENANT", amount: input.agreedAmount },
    created_at: now,
  });

  const otherPartyId = isLandlord ? contract.tenant_id : contract.landlord_id;
  if (otherPartyId) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: otherPartyId,
      type: "DISPUTE_AWAITING_CONFIRMATION",
      title: "Chờ xác nhận thỏa thuận tranh chấp",
      body: `Bên kia đã đề xuất số tiền thỏa thuận ${input.agreedAmount} ₫. Vui lòng xác nhận nếu đồng ý.`,
      read_at: null,
      created_at: now,
    });
  }

  // Enqueue onchain: resolve_dispute cho bên đã gửi
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "resolve_dispute",
        args: [contractId, input.agreedAmount],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue resolve_dispute onchain:", err);
    }
  }

  return formatDisputeDto(updatedDispute);
}

function formatDisputeDto(dispute: any): DisputeDto {
  return {
    status: dispute.status,
    openedBy: dispute.opened_by,
    note: dispute.note,
    landlordAgreedAmount: dispute.landlord_agreed_amount?.toString() ?? null,
    tenantAgreedAmount: dispute.tenant_agreed_amount?.toString() ?? null,
  };
}
