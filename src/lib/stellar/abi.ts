import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { ApiError } from "@/lib/api/http";

export const SOROBAN_ACTIONS = [
  "__constructor",
  "init",
  "create_contract",
  "tenant_confirm",
  "record_deposit_paid",
  "record_rent_paid",
  "mark_overdue",
  "calc_late_fee",
  "extend_due",
  "request_refund",
  "approve_refund",
  "propose_deduction",
  "respond_deduction",
  "open_dispute",
  "resolve_dispute",
  "get_contract",
  "get_rent_period",
] as const;

export type SorobanAction = (typeof SOROBAN_ACTIONS)[number];

function uuidToBytes16(uuid: string): xdr.ScVal {
  const clean = uuid.replace(/[-_]/g, "").toLowerCase();
  if (clean.length !== 32) {
    throw new ApiError("VALIDATION_ERROR", { field: "id" }, `Invalid UUID for 16-byte ID: ${uuid}`);
  }
  return xdr.ScVal.scvBytes(Buffer.from(clean, "hex"));
}

function hashToBytes32(hash: string, fieldName: string): xdr.ScVal {
  const clean = hash.replace(/^0x/i, "").toLowerCase();
  if (clean.length !== 64) {
    throw new ApiError(
      "VALIDATION_ERROR",
      { field: fieldName },
      `Invalid 32-byte hash (expected 64 hex characters): ${hash}`,
    );
  }
  return xdr.ScVal.scvBytes(Buffer.from(clean, "hex"));
}

function addressToScVal(addr: string, fieldName: string): xdr.ScVal {
  try {
    return new Address(addr).toScVal();
  } catch {
    throw new ApiError("VALIDATION_ERROR", { field: fieldName }, `Invalid Stellar address: ${addr}`);
  }
}

function i128ToScVal(amount: string | number | bigint, fieldName: string): xdr.ScVal {
  try {
    const val = BigInt(amount);
    return nativeToScVal(val, { type: "i128" });
  } catch {
    throw new ApiError("VALIDATION_ERROR", { field: fieldName }, `Invalid i128 amount: ${amount}`);
  }
}

function u32ToScVal(num: number | string, fieldName: string): xdr.ScVal {
  const val = Number(num);
  if (!Number.isInteger(val) || val < 0 || val > 4294967295) {
    throw new ApiError("VALIDATION_ERROR", { field: fieldName }, `Invalid u32 integer: ${num}`);
  }
  return nativeToScVal(val, { type: "u32" });
}

function u64ToScVal(num: bigint | number | string, fieldName: string): xdr.ScVal {
  try {
    const val = BigInt(num);
    return nativeToScVal(val, { type: "u64" });
  } catch {
    throw new ApiError("VALIDATION_ERROR", { field: fieldName }, `Invalid u64 integer: ${num}`);
  }
}

function boolToScVal(b: boolean | string | number): xdr.ScVal {
  const val = Boolean(b);
  return nativeToScVal(val, { type: "bool" });
}

/**
 * Xác định loại ký bắt buộc cho hàm Soroban theo CONTRACTS mục 6:
 * - Oracle: record_deposit_paid, record_rent_paid, mark_overdue
 * - Platform: init
 * - User: các hàm còn lại
 */
export function getRequiredSignerKind(action: string): "USER" | "ORACLE" | "PLATFORM" {
  switch (action) {
    case "__constructor":
    case "init":
      return "PLATFORM";
    case "record_deposit_paid":
    case "record_rent_paid":
    case "mark_overdue":
      return "ORACLE";
    default:
      return "USER";
  }
}

/**
 * Mã hóa tham số gọi hàm Soroban theo đúng ABI trong docs/CONTRACTS.md mục 6.
 * Hỗ trợ cả truyền theo object { id, landlord, ... } lẫn array [id, landlord, ...].
 */
export function encodeContractArgs(
  action: string,
  rawArgs: Record<string, unknown> | unknown[],
): xdr.ScVal[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any = Array.isArray(rawArgs) ? rawArgs : { ...rawArgs };

  switch (action) {
    case "__constructor":
    case "init": {
      // __constructor(admin: Address, oracle: Address)
      const admin = Array.isArray(args) ? args[0] : args.admin;
      const oracle = Array.isArray(args) ? args[1] : args.oracle;
      return [addressToScVal(admin, "admin"), addressToScVal(oracle, "oracle")];
    }

    case "create_contract": {
      // create_contract(id: BytesN<16>, landlord: Address, tenant: Address, doc_hash: BytesN<32>, deposit: i128, rent: i128, due_day: u32, late_fee_bps_per_day: u32)
      const id = Array.isArray(args) ? args[0] : args.id;
      const landlord = Array.isArray(args) ? args[1] : args.landlord;
      const tenant = Array.isArray(args) ? args[2] : args.tenant;
      const docHash = Array.isArray(args) ? args[3] : args.doc_hash || args.docHash;
      const deposit = Array.isArray(args) ? args[4] : args.deposit;
      const rent = Array.isArray(args) ? args[5] : args.rent;
      const dueDay = Array.isArray(args) ? args[6] : args.due_day || args.dueDay;
      const lateFeeBps = Array.isArray(args) ? args[7] : args.late_fee_bps_per_day || args.lateFeeBpsPerDay;

      return [
        uuidToBytes16(id),
        addressToScVal(landlord, "landlord"),
        addressToScVal(tenant, "tenant"),
        hashToBytes32(docHash, "doc_hash"),
        i128ToScVal(deposit, "deposit"),
        i128ToScVal(rent, "rent"),
        u32ToScVal(dueDay, "due_day"),
        u32ToScVal(lateFeeBps, "late_fee_bps_per_day"),
      ];
    }

    case "tenant_confirm": {
      // tenant_confirm(id: BytesN<16>, tenant: Address)
      const id = Array.isArray(args) ? args[0] : args.id;
      const tenant = Array.isArray(args) ? args[1] : args.tenant;
      return [uuidToBytes16(id), addressToScVal(tenant, "tenant")];
    }

    case "record_deposit_paid": {
      // record_deposit_paid(id: BytesN<16>, payment_ref_hash: BytesN<32>, amount: i128)
      const id = Array.isArray(args) ? args[0] : args.id;
      const refHash = Array.isArray(args) ? args[1] : args.payment_ref_hash || args.paymentRefHash;
      const amount = Array.isArray(args) ? args[2] : args.amount;
      return [uuidToBytes16(id), hashToBytes32(refHash, "payment_ref_hash"), i128ToScVal(amount, "amount")];
    }

    case "record_rent_paid": {
      // record_rent_paid(id: BytesN<16>, period: u32, amount: i128, payment_ref_hash: BytesN<32>)
      const id = Array.isArray(args) ? args[0] : args.id;
      const period = Array.isArray(args) ? args[1] : args.period;
      const amount = Array.isArray(args) ? args[2] : args.amount;
      const refHash = Array.isArray(args) ? args[3] : args.payment_ref_hash || args.paymentRefHash;
      return [
        uuidToBytes16(id),
        u32ToScVal(period, "period"),
        i128ToScVal(amount, "amount"),
        hashToBytes32(refHash, "payment_ref_hash"),
      ];
    }

    case "mark_overdue": {
      // mark_overdue(id: BytesN<16>, period: u32, days_late: u32)
      const id = Array.isArray(args) ? args[0] : args.id;
      const period = Array.isArray(args) ? args[1] : args.period;
      const daysLate = Array.isArray(args) ? args[2] : args.days_late || args.daysLate;
      return [uuidToBytes16(id), u32ToScVal(period, "period"), u32ToScVal(daysLate, "days_late")];
    }

    case "calc_late_fee": {
      // calc_late_fee(id: BytesN<16>, period: u32, days_late: u32)
      const id = Array.isArray(args) ? args[0] : args.id;
      const period = Array.isArray(args) ? args[1] : args.period;
      const daysLate = Array.isArray(args) ? args[2] : args.days_late || args.daysLate;
      return [uuidToBytes16(id), u32ToScVal(period, "period"), u32ToScVal(daysLate, "days_late")];
    }

    case "extend_due": {
      // extend_due(id: BytesN<16>, period: u32, new_due_ts: u64)
      const id = Array.isArray(args) ? args[0] : args.id;
      const period = Array.isArray(args) ? args[1] : args.period;
      const newDueTs = Array.isArray(args) ? args[2] : args.new_due_ts || args.newDueTs;
      return [uuidToBytes16(id), u32ToScVal(period, "period"), u64ToScVal(newDueTs, "new_due_ts")];
    }

    case "request_refund": {
      // request_refund(id: BytesN<16>, party: Address)
      const id = Array.isArray(args) ? args[0] : args.id;
      const party = Array.isArray(args) ? args[1] : args.party;
      return [uuidToBytes16(id), addressToScVal(party, "party")];
    }

    case "approve_refund": {
      // approve_refund(id: BytesN<16>, party: Address, refund_amount: i128)
      const id = Array.isArray(args) ? args[0] : args.id;
      const party = Array.isArray(args) ? args[1] : args.party;
      const refundAmount = Array.isArray(args) ? args[2] : args.refund_amount || args.refundAmount;
      return [uuidToBytes16(id), addressToScVal(party, "party"), i128ToScVal(refundAmount, "refund_amount")];
    }

    case "propose_deduction": {
      // propose_deduction(id: BytesN<16>, landlord: Address, amount: i128, reason_hash: BytesN<32>)
      const id = Array.isArray(args) ? args[0] : args.id;
      const landlord = Array.isArray(args) ? args[1] : args.landlord;
      const amount = Array.isArray(args) ? args[2] : args.amount;
      const reasonHash = Array.isArray(args) ? args[3] : args.reason_hash || args.reasonHash;
      return [
        uuidToBytes16(id),
        addressToScVal(landlord, "landlord"),
        i128ToScVal(amount, "amount"),
        hashToBytes32(reasonHash, "reason_hash"),
      ];
    }

    case "respond_deduction": {
      // respond_deduction(id: BytesN<16>, tenant: Address, accept: bool)
      const id = Array.isArray(args) ? args[0] : args.id;
      const tenant = Array.isArray(args) ? args[1] : args.tenant;
      const accept = Array.isArray(args) ? args[2] : args.accept;
      return [uuidToBytes16(id), addressToScVal(tenant, "tenant"), boolToScVal(accept)];
    }

    case "open_dispute": {
      // open_dispute(id: BytesN<16>, party: Address)
      const id = Array.isArray(args) ? args[0] : args.id;
      const party = Array.isArray(args) ? args[1] : args.party;
      return [uuidToBytes16(id), addressToScVal(party, "party")];
    }

    case "resolve_dispute": {
      // resolve_dispute(id: BytesN<16>, party: Address, agreed_amount: i128)
      const id = Array.isArray(args) ? args[0] : args.id;
      const party = Array.isArray(args) ? args[1] : args.party;
      const agreedAmount = Array.isArray(args) ? args[2] : args.agreed_amount || args.agreedAmount;
      return [uuidToBytes16(id), addressToScVal(party, "party"), i128ToScVal(agreedAmount, "agreed_amount")];
    }

    case "get_contract": {
      // get_contract(id: BytesN<16>)
      const id = Array.isArray(args) ? args[0] : args.id;
      return [uuidToBytes16(id)];
    }

    case "get_rent_period": {
      // get_rent_period(id: BytesN<16>, period: u32)
      const id = Array.isArray(args) ? args[0] : args.id;
      const period = Array.isArray(args) ? args[1] : args.period;
      return [uuidToBytes16(id), u32ToScVal(period, "period")];
    }

    default:
      throw new ApiError("VALIDATION_ERROR", { action }, `Unsupported Soroban action: ${action}`);
  }
}
