import { randomUUID } from "node:crypto";
import type { ChargeDto, ChargeKind, SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import type { DomainRepository } from "../repository";
import type { ChargeEntity } from "../types";

export type CreateChargeInput = {
  kind: ChargeKind;
  amount: string;
  note?: string | null;
  periodNo?: number | null;
};

const VALID_KINDS: ChargeKind[] = ["ELECTRICITY", "WATER", "SERVICE", "OTHER"];

const KIND_LABELS: Record<ChargeKind, string> = {
  ELECTRICITY: "tiền điện",
  WATER: "tiền nước",
  SERVICE: "phí dịch vụ",
  OTHER: "chi phí khác",
};

function mapChargeToDto(entity: ChargeEntity): ChargeDto {
  return {
    id: entity.id,
    periodNo: entity.period_no,
    kind: entity.kind,
    amount: entity.amount.toString(),
    note: entity.note,
    status: entity.status,
    createdAt: entity.created_at,
    paidAt: entity.paid_at,
  };
}

/**
 * Thêm khoản nợ phát sinh (điện, nước, dịch vụ...) cho hợp đồng thuê.
 * Chỉ chủ nhà của hợp đồng đang ACTIVE mới được thêm.
 * Khoản nợ phát sinh nằm ngoài hợp đồng thông minh, KHÔNG đưa lên blockchain.
 */
export async function createCharge(
  repo: DomainRepository,
  contractId: string,
  input: CreateChargeInput,
  user: SessionUser,
): Promise<ChargeDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy hợp đồng.");
  }

  // Chỉ chủ nhà (hoặc ADMIN_DEMO) mới có quyền thêm khoản nợ
  const isLandlord = contract.landlord_id === user.id || user.role === "ADMIN_DEMO";
  if (!isLandlord) {
    throw new ApiError("FORBIDDEN", undefined, "Chỉ chủ nhà mới có quyền thêm khoản nợ.");
  }

  // Hợp đồng phải đang ở trạng thái ACTIVE
  if (contract.status !== "ACTIVE") {
    throw new ApiError("VALIDATION_ERROR", undefined, "Chỉ có thể thêm khoản nợ cho hợp đồng đang hoạt động.");
  }

  // Kiểm tra loại khoản nợ
  if (!VALID_KINDS.includes(input.kind)) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Loại khoản nợ không hợp lệ.");
  }

  // Số tiền chỉ nhận chuỗi chữ số dương, giới hạn hợp lý (<= 100 tỷ VND)
  if (!/^\d+$/.test(input.amount)) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Số tiền phải là chuỗi chữ số nguyên dương.");
  }

  const amountBig = BigInt(input.amount);
  if (amountBig <= 0n) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Số tiền phải lớn hơn 0.");
  }
  if (amountBig > 100_000_000_000n) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Số tiền vượt quá giới hạn tối đa cho phép.");
  }

  // Kiểm tra periodNo nếu có
  if (input.periodNo != null) {
    if (!Number.isInteger(input.periodNo) || input.periodNo <= 0) {
      throw new ApiError("VALIDATION_ERROR", undefined, "Kỳ thuê không hợp lệ.");
    }
  }

  const now = new Date().toISOString();
  const chargeId = randomUUID();

  const entity: ChargeEntity = {
    id: chargeId,
    contract_id: contractId,
    period_no: input.periodNo ?? null,
    kind: input.kind,
    amount: amountBig,
    note: input.note ? input.note.trim() : null,
    status: "UNPAID",
    created_by: user.id,
    created_at: now,
    paid_at: null,
  };

  const created = await repo.charges.create(entity);

  // Ghi audit log
  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "CHARGE_CREATED",
    entity: "contract_charges",
    entity_id: chargeId,
    meta: {
      contractId,
      kind: input.kind,
      amount: input.amount,
      periodNo: input.periodNo ?? null,
    },
    created_at: now,
  });

  // Gửi thông báo cho người thuê nếu có
  if (contract.tenant_id) {
    const kindLabel = KIND_LABELS[input.kind] ?? "khoản phát sinh";
    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.tenant_id,
      type: "CHARGE_CREATED",
      title: "Khoản nợ mới được thêm",
      body: `Chủ nhà đã thêm khoản ${kindLabel} số tiền ${input.amount} ₫ cho hợp đồng phòng ${contract.room_label}.`,
      read_at: null,
      created_at: now,
    });
  }

  return mapChargeToDto(created);
}

/**
 * Chủ nhà đánh dấu đã nhận thanh toán khoản nợ ngoài hệ thống.
 * Trạng thái này có nghĩa là "chủ nhà xác nhận đã nhận ngoài hệ thống",
 * KHÔNG ngụ ý hay đại diện cho xác nhận ngân hàng.
 * Khoản nợ phát sinh nằm ngoài hợp đồng thông minh, KHÔNG đưa lên blockchain.
 */
export async function markChargePaid(
  repo: DomainRepository,
  contractId: string,
  chargeId: string,
  user: SessionUser,
): Promise<ChargeDto> {
  const contract = await repo.contracts.findById(contractId);
  if (!contract) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy hợp đồng.");
  }

  // Chỉ chủ nhà (hoặc ADMIN_DEMO) mới có quyền đánh dấu đã nhận
  const isLandlord = contract.landlord_id === user.id || user.role === "ADMIN_DEMO";
  if (!isLandlord) {
    throw new ApiError("FORBIDDEN", undefined, "Chỉ chủ nhà mới có quyền đánh dấu khoản nợ đã nhận.");
  }

  // Hợp đồng phải đang ACTIVE
  if (contract.status !== "ACTIVE") {
    throw new ApiError("VALIDATION_ERROR", undefined, "Chỉ có thể thao tác khi hợp đồng đang hoạt động.");
  }

  const charge = await repo.charges.findById(chargeId);
  if (!charge || charge.contract_id !== contractId) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy khoản nợ.");
  }

  // Không cho phép đánh dấu đã nhận hai lần
  if (charge.status === "PAID") {
    throw new ApiError(
      "VALIDATION_ERROR",
      undefined,
      "Khoản nợ này đã được chủ nhà xác nhận đã nhận ngoài hệ thống trước đó.",
    );
  }

  const now = new Date().toISOString();

  const updated = await repo.charges.update(chargeId, {
    status: "PAID",
    paid_at: now,
  });

  // Ghi audit log
  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "CHARGE_MARKED_PAID",
    entity: "contract_charges",
    entity_id: chargeId,
    meta: {
      contractId,
      confirmationNote: "Chủ nhà xác nhận đã nhận ngoài hệ thống",
    },
    created_at: now,
  });

  // Gửi thông báo cho người thuê nếu có
  if (contract.tenant_id) {
    const kindLabel = KIND_LABELS[charge.kind] ?? "khoản phát sinh";
    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.tenant_id,
      type: "CHARGE_PAID",
      title: "Khoản nợ đã được thanh toán",
      body: `Chủ nhà đã xác nhận đã nhận ngoài hệ thống khoản ${kindLabel} số tiền ${charge.amount.toString()} ₫ cho hợp đồng phòng ${contract.room_label}.`,
      read_at: null,
      created_at: now,
    });
  }

  return mapChargeToDto(updated);
}
