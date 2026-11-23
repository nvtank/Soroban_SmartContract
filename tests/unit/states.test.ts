import { describe, expect, it } from "vitest";
import {
  CONTRACT_STATUSES,
  CONTRACT_TRANSITIONS,
  DEDUCTION_STATUSES,
  DEDUCTION_TRANSITIONS,
  DEPOSIT_STATUSES,
  DEPOSIT_TRANSITIONS,
  DISPUTE_STATUSES,
  DISPUTE_TRANSITIONS,
  InvalidTransitionError,
  ONCHAIN_TX_STATUSES,
  ONCHAIN_TX_TRANSITIONS,
  PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
  RENT_STATUSES,
  RENT_TRANSITIONS,
  assertDepositTransition,
  assertTransition,
  canTransition,
  canTransitionDeposit,
} from "@/domain/states";

const machines = [
  ["contract", CONTRACT_STATUSES, CONTRACT_TRANSITIONS],
  ["deposit", DEPOSIT_STATUSES, DEPOSIT_TRANSITIONS],
  ["rent", RENT_STATUSES, RENT_TRANSITIONS],
  ["dispute", DISPUTE_STATUSES, DISPUTE_TRANSITIONS],
  ["payment", PAYMENT_STATUSES, PAYMENT_TRANSITIONS],
  ["deduction", DEDUCTION_STATUSES, DEDUCTION_TRANSITIONS],
  ["onchain", ONCHAIN_TX_STATUSES, ONCHAIN_TX_TRANSITIONS],
] as const;

describe.each(machines)("%s state machine", (_name, statuses, rawTable) => {
  const table = rawTable as Readonly<Record<string, readonly string[]>>;

  it("allows exactly the transitions in the table", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransition(table, from, to)).toBe(table[from].includes(to));
        if (table[from].includes(to)) {
          expect(() => assertTransition(table, from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(table, from, to)).toThrow(InvalidTransitionError);
        }
      }
    }
  });
});

describe("deposit release rules", () => {
  it("never releases a disputed deposit before RESOLVED", () => {
    for (const to of ["REFUNDED", "DEDUCTED"] as const) {
      for (const dispute of ["NONE", "IN_PROGRESS", "AWAITING_CONFIRMATION"] as const) {
        expect(canTransitionDeposit("PENDING_DISPUTE", to, dispute)).toBe(false);
      }
      expect(canTransitionDeposit("PENDING_DISPUTE", to, "RESOLVED")).toBe(true);
    }
  });

  it("releases a pending refund only when no dispute exists", () => {
    expect(canTransitionDeposit("PENDING_REFUND", "REFUNDED", "NONE")).toBe(true);
    expect(canTransitionDeposit("PENDING_REFUND", "DEDUCTED", "NONE")).toBe(true);
    for (const dispute of ["IN_PROGRESS", "AWAITING_CONFIRMATION", "RESOLVED"] as const) {
      expect(canTransitionDeposit("PENDING_REFUND", "REFUNDED", dispute)).toBe(false);
    }
  });

  it("cannot skip straight from UNPAID or RECORDED to a release", () => {
    expect(() => assertDepositTransition("UNPAID", "REFUNDED", "NONE")).toThrow(InvalidTransitionError);
    expect(() => assertDepositTransition("RECORDED", "REFUNDED", "NONE")).toThrow(InvalidTransitionError);
  });
});
