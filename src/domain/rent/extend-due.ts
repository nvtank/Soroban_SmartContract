import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api/http";
import type { SessionUser } from "@/domain/dto";
import { RENT_TRANSITIONS, assertTransition } from "@/domain/states";
import type { DomainRepository, EnqueueOnchainFn } from "../repository";

export const extendDueSchema = z.object({
  /** Hạn thanh toán mới, định dạng YYYY-MM-DD */
  newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});
export type ExtendDueInput = z.infer<typeof extendDueSchema>;

export type ExtendDueDeps = { enqueueOnchain?: EnqueueOnchainFn; today?: () => string };

/** Mốc 00:00 theo giờ Việt Nam của ngày YYYY-MM-DD, tính bằng giây Unix. */
function dueTimestamp(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00+07:00`) / 1000);
}

/**
 * Chủ nhà đồng ý cho hoãn nợ: kỳ thuê đang QUÁ HẠN chuyển về CHỜ THANH TOÁN với hạn mới,
 * phí trễ đã tính được xóa theo thỏa thuận và việc này được ghi lại (nhật ký, thông báo, on-chain).
 * Không bao giờ tự động áp dụng: chỉ chủ nhà của hợp đồng mới được thực hiện.
 */
export async function extendDue(
  repo: DomainRepository,
  contractId: string,
  periodNo: number,
  rawInput: ExtendDueInput,
  user: SessionUser,
  deps?: ExtendDueDeps,
) {
  const input = extendDueSchema.parse(rawInput);

  const contract = await repo.contracts.findById(contractId);
  if (!contract) throw new ApiError("NOT_FOUND");
  if (contract.landlord_id !== user.id) throw new ApiError("FORBIDDEN");
  if (contract.status !== "ACTIVE") throw new ApiError("INVALID_TRANSITION");

  const period = await repo.rentPeriods.findByPeriod(contractId, periodNo);
  if (!period) throw new ApiError("NOT_FOUND");

  const today = deps?.today?.() ?? new Date().toISOString().slice(0, 10);
  if (input.newDueDate <= today || input.newDueDate <= period.due_date) {
    throw new ApiError(
      "VALIDATION_ERROR",
      { field: "newDueDate" },
      "Hạn mới phải sau hôm nay và sau hạn cũ.",
    );
  }
  // Chỉ kỳ đang QUÁ HẠN mới được gia hạn (bảng chuyển trạng thái và contract cùng quy định)
  if (period.status !== "OVERDUE") throw new ApiError("INVALID_TRANSITION");
  assertTransition(RENT_TRANSITIONS, period.status, "AWAITING_PAYMENT");

  const now = new Date().toISOString();
  const updated = await repo.rentPeriods.update(contractId, periodNo, {
    due_date: input.newDueDate,
    status: "AWAITING_PAYMENT",
    late_days: 0,
    late_fee: 0n,
  });

  await repo.auditLogs.create({
    id: randomUUID(),
    actor_id: user.id,
    action: "RENT_DUE_EXTENDED",
    entity: "rent_periods",
    entity_id: `${contractId}:${periodNo}`,
    meta: {
      previousDueDate: period.due_date,
      newDueDate: input.newDueDate,
      waivedLateFee: period.late_fee.toString(),
    },
    created_at: now,
  });

  if (contract.tenant_id) {
    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.tenant_id,
      type: "RENT_DUE_EXTENDED",
      title: "Chủ nhà đã gia hạn thanh toán",
      body: `Kỳ ${periodNo} phòng ${contract.room_label} được gia hạn đến ${input.newDueDate}. Phí trễ đã tính được miễn.`,
      read_at: null,
      created_at: now,
    });
  }

  // Ghi nhận on-chain: extend_due(id, period, new_due_ts), landlord ký. Lỗi chain không làm hỏng nghiệp vụ.
  if (deps?.enqueueOnchain) {
    try {
      await deps.enqueueOnchain(repo, {
        contractId,
        action: "extend_due",
        args: [contractId, periodNo, dueTimestamp(input.newDueDate)],
        signer: { kind: "USER", userId: user.id },
      });
    } catch (err) {
      console.error("[domain] Failed to enqueue extend_due onchain:", err);
    }
  }

  return {
    periodNo: updated.period_no,
    dueDate: updated.due_date,
    status: updated.status,
    lateDays: updated.late_days,
    lateFee: updated.late_fee.toString(),
  };
}
