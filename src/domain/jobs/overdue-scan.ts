import { randomUUID } from "node:crypto";
import { assertTransition, RENT_TRANSITIONS } from "@/domain/states";
import type { DomainRepository, EnqueueOnchainFn } from "../repository";

export type OverdueScanDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
};

export type OverdueScanResult = {
  scannedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  remindedCount: number;
  updatedPeriods: {
    contractId: string;
    periodNo: number;
    daysLate: number;
    lateFee: string;
  }[];
};

/**
 * Lấy ngày hiện tại theo múi giờ Asia/Ho_Chi_Minh định dạng YYYY-MM-DD.
 */
export function getVietnamToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Quét các kỳ thuê quá hạn và tính phí trễ.
 * Công thức phí trễ theo CONTRACTS.md mục 3: late_fee = rent * bps * days / 10000 (làm tròn xuống).
 * Idempotent trong ngày: nếu kỳ thuê đã được quét cho cùng số ngày trễ (cùng ngày), không cộng phí và không gửi lại thông báo/onchain.
 */
export async function scanOverdue(
  repo: DomainRepository,
  options?: { asOfDate?: string; contractId?: string },
  deps?: OverdueScanDeps,
): Promise<OverdueScanResult> {
  const asOf = options?.asOfDate ?? getVietnamToday();
  const candidates = await repo.rentPeriods.findOverdueCandidates(asOf, options?.contractId);

  let overdueCount = 0;
  const updatedPeriods: OverdueScanResult["updatedPeriods"] = [];
  const now = new Date().toISOString();

  for (const period of candidates) {
    const contract = await repo.contracts.findById(period.contract_id);
    if (!contract || contract.status !== "ACTIVE") continue;

    // Tính số ngày trễ chuẩn xác theo UTC date
    const [asOfYear, asOfMonth, asOfDay] = asOf.split("-").map(Number);
    const [dueYear, dueMonth, dueDay] = period.due_date.split("-").map(Number);
    const asOfUtc = Date.UTC(asOfYear, asOfMonth - 1, asOfDay);
    const dueUtc = Date.UTC(dueYear, dueMonth - 1, dueDay);
    const diffMs = asOfUtc - dueUtc;
    const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) continue;

    // Idempotent: nếu kỳ thuê đã là OVERDUE và đã ghi nhận đúng số ngày trễ này trong ngày, bỏ qua
    if (period.status === "OVERDUE" && period.late_days === daysLate) {
      continue;
    }

    // late_fee = rent * bps * days / 10000
    const rentAmount = contract.rent_amount;
    const bps = BigInt(contract.late_fee_bps_per_day);
    const days = BigInt(daysLate);
    const lateFee = (rentAmount * bps * days) / 10000n;

    // Chuyển sang OVERDUE qua assertTransition
    assertTransition(RENT_TRANSITIONS, period.status, "OVERDUE");

    await repo.rentPeriods.update(period.contract_id, period.period_no, {
      status: "OVERDUE",
      late_days: daysLate,
      late_fee: lateFee,
    });

    overdueCount++;
    updatedPeriods.push({
      contractId: period.contract_id,
      periodNo: period.period_no,
      daysLate,
      lateFee: lateFee.toString(),
    });

    await repo.auditLogs.create({
      id: randomUUID(),
      actor_id: null,
      action: "RENT_MARKED_OVERDUE",
      entity: "rent_periods",
      entity_id: `${period.contract_id}:${period.period_no}`,
      meta: {
        systemActor: "system:cron",
        contractId: period.contract_id,
        periodNo: period.period_no,
        daysLate,
        lateFee: lateFee.toString(),
      },
      created_at: now,
    });

    if (contract.tenant_id) {
      await repo.notifications.create({
        id: randomUUID(),
        user_id: contract.tenant_id,
        type: "RENT_OVERDUE",
        title: "Kỳ thuê quá hạn thanh toán",
        body: `Kỳ thuê số ${period.period_no} phòng ${contract.room_label} đã quá hạn ${daysLate} ngày. Phí trễ phát sinh: ${lateFee.toString()} ₫.`,
        read_at: null,
        created_at: now,
      });
    }

    // Enqueue onchain: mark_overdue(id, period, days_late) với signer: ORACLE
    if (deps?.enqueueOnchain) {
      try {
        await deps.enqueueOnchain(repo, {
          contractId: period.contract_id,
          action: "mark_overdue",
          args: [period.contract_id, period.period_no, daysLate],
          signer: { kind: "ORACLE" },
        });
      } catch (err) {
        console.error("[domain] Failed to enqueue mark_overdue onchain:", err);
      }
    }
  }

  // --- Quét nhắc trước hạn cho kỳ AWAITING_PAYMENT đến hạn trong vòng 3 ngày ---
  let dueSoonCount = 0;
  let dueSoonCandidates: typeof candidates = [];
  if (repo.rentPeriods.findDueSoonCandidates) {
    dueSoonCandidates = await repo.rentPeriods.findDueSoonCandidates(asOf, options?.contractId);
  } else if (options?.contractId) {
    const periods = await repo.rentPeriods.listByContractId(options.contractId);
    const [y, m, d] = asOf.split("-").map(Number);
    const maxDate = new Date(Date.UTC(y, m - 1, d + 3)).toISOString().slice(0, 10);
    dueSoonCandidates = periods.filter(
      (p) => p.status === "AWAITING_PAYMENT" && p.due_date >= asOf && p.due_date <= maxDate,
    );
  }

  for (const period of dueSoonCandidates) {
    const contract = await repo.contracts.findById(period.contract_id);
    if (!contract || contract.status !== "ACTIVE" || !contract.tenant_id) continue;

    // Idempotent trong ngày: kiểm tra đã có thông báo RENT_DUE_SOON cho kỳ này trong ngày quét chưa
    const existingNotifs = await repo.notifications.listByUserId(contract.tenant_id);
    const alreadyNotified = existingNotifs.some((n) => {
      if (n.type !== "RENT_DUE_SOON") return false;
      const matchesPeriod =
        n.body.includes(`Kỳ thuê số ${period.period_no}`) && n.body.includes(contract.room_label);
      if (!matchesPeriod) return false;
      return n.created_at.startsWith(asOf) || n.created_at.startsWith(now.slice(0, 10));
    });

    if (alreadyNotified) continue;

    const notifCreatedAt = options?.asOfDate ? `${options.asOfDate}T09:00:00.000Z` : now;
    await repo.notifications.create({
      id: randomUUID(),
      user_id: contract.tenant_id,
      type: "RENT_DUE_SOON",
      title: "Nhắc hạn thanh toán tiền thuê",
      body: `Kỳ thuê số ${period.period_no} phòng ${contract.room_label} sẽ đến hạn vào ngày ${period.due_date}. Vui lòng thanh toán đúng hạn.`,
      read_at: null,
      created_at: notifCreatedAt,
    });

    dueSoonCount++;
  }

  return {
    scannedCount: candidates.length + dueSoonCandidates.length,
    overdueCount,
    dueSoonCount,
    remindedCount: dueSoonCount,
    updatedPeriods,
  };
}
