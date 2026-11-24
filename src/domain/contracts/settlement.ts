import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDepositTransition, assertTransition, RENT_TRANSITIONS } from "@/domain/states";
import { hashPaymentRef } from "../hashing";
import type { DomainRepository, EnqueueOnchainFn } from "../repository";
import { createSupabaseDomainRepository } from "../supabase-repository";

export type SettlementDeps = {
  enqueueOnchain?: EnqueueOnchainFn;
};

/**
 * Quyết toán thanh toán (settlePayment) — idempotent.
 * Được Agent E gọi sau khi đã xác định trạng thái payment (CONFIRMED hoặc UNDERPAID).
 * db có thể là DomainRepository hoặc Supabase client.
 */
export async function settlePayment(
  db: SupabaseClient | DomainRepository,
  paymentId: string,
  deps?: SettlementDeps,
): Promise<void> {
  const supabaseClient: SupabaseClient | null =
    "from" in db && typeof (db as SupabaseClient).rpc === "function"
      ? (db as SupabaseClient)
      : "db" in db && typeof (db as Record<string, unknown>).db === "object" && typeof ((db as Record<string, unknown>).db as SupabaseClient)?.rpc === "function"
        ? ((db as Record<string, unknown>).db as SupabaseClient)
        : null;

  if (supabaseClient) {
    const { data, error } = await supabaseClient.rpc("settle_payment_atomic", {
      p_payment_id: paymentId,
    });

    if (error) {
      console.error("[settlement] Atomic settle RPC error:", error);
      throw error;
    }
    if (!data || data.error) {
      if (data?.error === "PAYMENT_NOT_FOUND") {
        console.warn(`[settlement] Payment not found: ${paymentId}`);
        return;
      }
      throw new Error(`Settlement RPC failed: ${data?.error}`);
    }

    if (data.action_taken === "ALREADY_SETTLED") {
      return; // Idempotent: already settled!
    }

    const payment = data.payment;
    const now = new Date().toISOString();
    const repo = createSupabaseDomainRepository(supabaseClient);
    const contract = await repo.contracts.findById(payment.contract_id);
    if (!contract) return;

    const paymentRefHash = hashPaymentRef(
      payment.provider,
      BigInt(payment.order_code),
      payment.payment_ref_salt,
    );

    if (data.action_taken === "DEPOSIT_RECORDED") {
      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: null,
        action: "DEPOSIT_RECORDED",
        entity: "deposits",
        entity_id: payment.contract_id,
        meta: {
          systemActor: "system:settlement",
          paymentId,
          amount: payment.business_amount.toString(),
          paymentRefHash,
        },
        created_at: now,
      });

      for (const uid of [contract.landlord_id, contract.tenant_id].filter(Boolean) as string[]) {
        await repo.notifications.create({
          id: randomUUID(),
          user_id: uid,
          type: "DEPOSIT_RECORDED",
          title: "Tiền cọc đã được ghi nhận",
          body: `Tiền cọc phòng ${contract.room_label} (${payment.business_amount.toString()} ₫) đã được nạp thành công và bảo chứng.`,
          read_at: null,
          created_at: now,
        });
      }

      if (deps?.enqueueOnchain) {
        try {
          await deps.enqueueOnchain(repo, {
            contractId: payment.contract_id,
            action: "record_deposit_paid",
            args: [payment.contract_id, paymentRefHash, payment.business_amount.toString()],
            signer: { kind: "ORACLE" },
          });
        } catch (err) {
          console.error("[settlement] Failed to enqueue record_deposit_paid onchain:", err);
        }
      }
      return;
    }

    if (data.action_taken === "RENT_UPDATED") {
      const periodNo = Number(payment.period_no);
      const rentPeriod = data.rent_period;
      const targetStatus = rentPeriod.status;

      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: null,
        action: targetStatus === "PAID" ? "RENT_PAID" : "RENT_PARTIALLY_PAID",
        entity: "rent_periods",
        entity_id: `${payment.contract_id}:${periodNo}`,
        meta: {
          systemActor: "system:settlement",
          paymentId,
          periodNo,
          amountPaid: rentPeriod.amount_paid.toString(),
          status: targetStatus,
          paymentRefHash,
        },
        created_at: now,
      });

      if (contract.tenant_id) {
        await repo.notifications.create({
          id: randomUUID(),
          user_id: contract.tenant_id,
          type: "RENT_PAID",
          title: `Thanh toán kỳ thuê số ${periodNo}`,
          body:
            targetStatus === "PAID"
              ? `Đã thanh toán đủ kỳ thuê số ${periodNo}.`
              : `Đã ghi nhận thanh toán một phần (${rentPeriod.amount_paid.toString()} ₫) cho kỳ thuê số ${periodNo}.`,
          read_at: null,
          created_at: now,
        });
      }

      if (deps?.enqueueOnchain) {
        try {
          await deps.enqueueOnchain(repo, {
            contractId: payment.contract_id,
            action: "record_rent_paid",
            args: [
              payment.contract_id,
              periodNo,
              payment.business_amount.toString(),
              paymentRefHash,
            ],
            signer: { kind: "ORACLE" },
          });
        } catch (err) {
          console.error("[settlement] Failed to enqueue record_rent_paid onchain:", err);
        }
      }
      return;
    }

    if (data.action_taken === "RENT_PARTIALLY_PAID") {
      const periodNo = Number(payment.period_no);
      await repo.auditLogs.create({
        id: randomUUID(),
        actor_id: null,
        action: "RENT_UNDERPAID",
        entity: "rent_periods",
        entity_id: `${payment.contract_id}:${periodNo}`,
        meta: {
          systemActor: "system:settlement",
          paymentId,
          paidAmount: payment.paid_amount.toString(),
        },
        created_at: now,
      });
      return;
    }

    return;
  }

  // Fallback cho In-Memory / Fake repository (phục vụ unit test không có Supabase RPC)
  const repo: DomainRepository =
    "contracts" in db && typeof (db as DomainRepository).contracts?.findById === "function"
      ? (db as DomainRepository)
      : createSupabaseDomainRepository(db as SupabaseClient);

  const payment = await repo.payments.findById(paymentId);
  if (!payment) {
    console.warn(`[settlement] Payment not found: ${paymentId}`);
    return;
  }

  // Idempotency: nếu đã settled, bỏ qua không xử lý lại
  if (payment.settled_at) {
    return;
  }

  const now = new Date().toISOString();
  const contract = await repo.contracts.findById(payment.contract_id);
  if (!contract) {
    console.warn(`[settlement] Contract not found: ${payment.contract_id}`);
    return;
  }

  const dispute = await repo.disputes.findByContractId(payment.contract_id);
  const disputeStatus = dispute?.status ?? "NONE";

  if (payment.status === "CONFIRMED") {
    if (payment.kind === "DEPOSIT") {
      const deposit = await repo.deposits.findByContractId(payment.contract_id);
      if (deposit && deposit.status === "UNPAID") {
        // Chuyển UNPAID -> RECORDED qua assertDepositTransition
        assertDepositTransition("UNPAID", "RECORDED", disputeStatus);

        await repo.deposits.update(payment.contract_id, {
          status: "RECORDED",
          paid_amount: payment.business_amount,
        });

        const paymentRefHash = hashPaymentRef(payment.provider, payment.order_code, payment.payment_ref_salt);

        await repo.auditLogs.create({
          id: randomUUID(),
          actor_id: null,
          action: "DEPOSIT_RECORDED",
          entity: "deposits",
          entity_id: payment.contract_id,
          meta: {
            systemActor: "system:settlement",
            paymentId,
            amount: payment.business_amount.toString(),
            paymentRefHash,
          },
          created_at: now,
        });

        for (const uid of [contract.landlord_id, contract.tenant_id].filter(Boolean) as string[]) {
          await repo.notifications.create({
            id: randomUUID(),
            user_id: uid,
            type: "DEPOSIT_RECORDED",
            title: "Tiền cọc đã được ghi nhận",
            body: `Tiền cọc phòng ${contract.room_label} (${payment.business_amount.toString()} ₫) đã được nạp thành công và bảo chứng.`,
            read_at: null,
            created_at: now,
          });
        }

        // Enqueue onchain: record_deposit_paid(id, payment_ref_hash, amount) với signer: ORACLE
        if (deps?.enqueueOnchain) {
          try {
            await deps.enqueueOnchain(repo, {
              contractId: payment.contract_id,
              action: "record_deposit_paid",
              args: [payment.contract_id, paymentRefHash, payment.business_amount.toString()],
              signer: { kind: "ORACLE" },
            });
          } catch (err) {
            console.error("[settlement] Failed to enqueue record_deposit_paid onchain:", err);
          }
        }
      }
    } else if (payment.kind === "RENT" && payment.period_no !== null) {
      const period = await repo.rentPeriods.findByPeriod(payment.contract_id, payment.period_no);
      if (period) {
        const newPaid = period.amount_paid + payment.business_amount;
        const targetStatus = newPaid >= period.amount_due ? "PAID" : "PARTIALLY_PAID";

        assertTransition(RENT_TRANSITIONS, period.status, targetStatus);

        await repo.rentPeriods.update(payment.contract_id, payment.period_no, {
          amount_paid: newPaid,
          status: targetStatus,
        });

        const paymentRefHash = hashPaymentRef(payment.provider, payment.order_code, payment.payment_ref_salt);

        await repo.auditLogs.create({
          id: randomUUID(),
          actor_id: null,
          action: targetStatus === "PAID" ? "RENT_PAID" : "RENT_PARTIALLY_PAID",
          entity: "rent_periods",
          entity_id: `${payment.contract_id}:${payment.period_no}`,
          meta: {
            systemActor: "system:settlement",
            paymentId,
            periodNo: payment.period_no,
            amountPaid: newPaid.toString(),
            status: targetStatus,
            paymentRefHash,
          },
          created_at: now,
        });

        if (contract.tenant_id) {
          await repo.notifications.create({
            id: randomUUID(),
            user_id: contract.tenant_id,
            type: "RENT_PAID",
            title: `Thanh toán kỳ thuê số ${payment.period_no}`,
            body:
              targetStatus === "PAID"
                ? `Đã thanh toán đủ kỳ thuê số ${payment.period_no}.`
                : `Đã ghi nhận thanh toán một phần (${newPaid.toString()} ₫) cho kỳ thuê số ${payment.period_no}.`,
            read_at: null,
            created_at: now,
          });
        }

        // Enqueue onchain: record_rent_paid(id, period, amount, payment_ref_hash) với signer: ORACLE
        if (deps?.enqueueOnchain) {
          try {
            await deps.enqueueOnchain(repo, {
              contractId: payment.contract_id,
              action: "record_rent_paid",
              args: [
                payment.contract_id,
                payment.period_no,
                payment.business_amount.toString(),
                paymentRefHash,
              ],
              signer: { kind: "ORACLE" },
            });
          } catch (err) {
            console.error("[settlement] Failed to enqueue record_rent_paid onchain:", err);
          }
        }
      }
    }
  } else if (payment.status === "UNDERPAID") {
    // Thiếu tiền:
    // Với RENT: ghi nhận một phần (PARTIALLY_PAID)
    if (payment.kind === "RENT" && payment.period_no !== null && payment.paid_amount > 0n) {
      const period = await repo.rentPeriods.findByPeriod(payment.contract_id, payment.period_no);
      if (period) {
        const newPaid = period.amount_paid + payment.paid_amount;
        assertTransition(RENT_TRANSITIONS, period.status, "PARTIALLY_PAID");

        await repo.rentPeriods.update(payment.contract_id, payment.period_no, {
          amount_paid: newPaid,
          status: "PARTIALLY_PAID",
        });

        await repo.auditLogs.create({
          id: randomUUID(),
          actor_id: null,
          action: "RENT_UNDERPAID",
          entity: "rent_periods",
          entity_id: `${payment.contract_id}:${payment.period_no}`,
          meta: { systemActor: "system:settlement", paymentId, paidAmount: payment.paid_amount.toString() },
          created_at: now,
        });
      }
    }
    // Với DEPOSIT: KHÔNG chuyển cọc sang RECORDED vì cọc nộp thiếu bị từ chối
  }

  // Đánh dấu đã settled để đảm bảo idempotent
  await repo.payments.update(paymentId, { settled_at: now });
}
