import { describe, expect, it } from "vitest";
import {
  canonicalizeContract,
  hashContract,
  hashPaymentRef,
  hashReason,
  newSalt,
  saltedHash,
} from "@/domain/hashing";

describe("domain hashing & canonicalization", () => {
  const sampleContract = {
    contract_id: "11111111-1111-1111-1111-111111111111",
    room_label: "Phòng 101",
    rent_amount: "5000000",
    deposit_amount: "5000000",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    due_day: 5,
    late_fee_bps_per_day: 50,
    terms_text: "Điều khoản hợp đồng mẫu\r\nXuống dòng Windows",
  };

  it("generates a 32-byte (64 hex char) random salt", () => {
    const salt1 = newSalt();
    const salt2 = newSalt();
    expect(salt1).toHaveLength(64);
    expect(salt2).toHaveLength(64);
    expect(salt1).not.toBe(salt2);
    expect(saltedHash(salt1, "test-data")).toHaveLength(64);
  });

  it("canonicalizes contract with byte-sorted keys, normalized line breaks and NFC", () => {
    const canonical = canonicalizeContract(sampleContract);
    const parsed = JSON.parse(canonical);
    const keys = Object.keys(parsed);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
    // In serialized JSON, line breaks inside strings are escaped as \n
    expect(canonical).not.toContain("\r");
    expect(canonical).toContain("\\n");
  });

  it("computes deterministic hash for identical input and salt", () => {
    const salt = newSalt();
    const hash1 = hashContract(sampleContract, salt);
    const hash2 = hashContract(sampleContract, salt);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("changing one character produces a completely different hash", () => {
    const salt = newSalt();
    const hash1 = hashContract(sampleContract, salt);
    const hash2 = hashContract({ ...sampleContract, room_label: "Phòng 102" }, salt);
    expect(hash1).not.toBe(hash2);
  });

  it("computes reason_hash with salt correctly", () => {
    const salt = newSalt();
    const reason = "Hỏng sơn tường phòng khách";
    const hash1 = hashReason(reason, salt);
    const hash2 = hashReason(reason, salt);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("computes payment_ref_hash with salt correctly", () => {
    const salt = newSalt();
    const hash1 = hashPaymentRef("PAYOS", 123456n, salt);
    const hash2 = hashPaymentRef("PAYOS", "123456", salt);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
