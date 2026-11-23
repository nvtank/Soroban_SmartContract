import { randomUUID } from "node:crypto";
import { assertTransition, RENT_TRANSITIONS } from "@/domain/states";
import type { DomainRepository, EnqueueOnchainFn } from "../repository";

export type OverdueScanDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
};

export type OverdueScanResult = {
  scannedCount: number;
  overdueCount: number;
  updatedPeriods: {
    contractId: string;
    periodNo: number;
    daysLate: number;
    lateFee: string;
  }[];
};

/**
 * Quét các kỳ thuê quá hạn và tính phí trễ.
 * Công thức phí trễ theo CONTRACTS.md mục 3: late_fee = rent * bps * days / 10000 (làm tròn xuống).
 */
export async function scanOverdue(
  repo: DomainRepository,
  options?: { asOfDate?: string },
  deps?: OverdueScanDeps,
): Promise<OverdueScanResult> {
  const asOf = options?.asOfDate ?? new Date().toISOString().slice(0, 10);
  const candidates = await repo.rentPeriods.findOverdueCandidates(asOf);

  let overdueCount = 0;
  const updatedPeriods: OverdueScanResult["updatedPeriods"] = [];
  const now = new Date().toISOString();

  for (const period of candidates) {
    const contract = await repo.contracts.findById(period.contract_id);
    if (!contract || contract.status !== "ACTIVE") continue;

    // Tính số ngày trễ: chênh lệch giữa ngày quét và ngày đến hạn
    const dueDateTs = new Date(period.due_date).getTime();
    const asOfTs = new Date(asOf).getTime();
    const diffMs = asOfTs - dueDateTs;
    const daysLate = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

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
      actor_id: "system:cron",
      action: "RENT_MARKED_OVERDUE",
      entity: "rent_periods",
      entity_id: `${period.contract_id}:${period.period_no}`,
      meta: {
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

  return {
    scannedCount: candidates.length,
    overdueCount,
    updatedPeriods,
  };
}
