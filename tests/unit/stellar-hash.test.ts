import { describe, it, expect } from "vitest";
import {
  newSalt,
  canonicalizeContract,
  saltedHash,
  hashDoc,
  hashReason,
  hashPaymentRef,
} from "@/lib/stellar/hash";
import type { CanonicalContractInput } from "@/lib/stellar/types";

describe("Stellar Hash Utilities", () => {
  const sampleInput: CanonicalContractInput = {
    contract_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    room_label: "Phòng 301 - Tòa nhà Sunshine",
    rent_amount: "5000000",
    deposit_amount: "10000000",
    start_date: "2026-12-01",
    end_date: "2027-12-01",
    due_day: 5,
    late_fee_bps_per_day: 50,
    terms_text: "1. Tiền thuê thanh toán trước ngày 05 hàng tháng.\n2. Giữ gìn vệ sinh chung.",
  };

  describe("newSalt", () => {
    it("tạo salt 32 byte dạng 64 ký tự hex chữ thường", () => {
      const salt = newSalt();
      expect(salt).toMatch(/^[0-9a-f]{64}$/);
    });

    it("hai lần gọi liên tiếp sinh ra 2 salt ngẫu nhiên khác nhau", () => {
      const s1 = newSalt();
      const s2 = newSalt();
      expect(s1).not.toBe(s2);
    });
  });

  describe("canonicalizeContract", () => {
    it("chuẩn hóa các khóa theo đúng thứ tự byte ASCII và không có khoảng trắng dư thừa", () => {
      const canonical = canonicalizeContract(sampleInput);

      // Kiểm tra thứ tự các khóa
      const expectedKeys = [
        "contract_id",
        "deposit_amount",
        "due_day",
        "end_date",
        "late_fee_bps_per_day",
        "rent_amount",
        "room_label",
        "start_date",
        "terms_text",
      ];

      const parsed = JSON.parse(canonical);
      expect(Object.keys(parsed)).toEqual(expectedKeys);
      // Không có khoảng trắng formatting (pretty-print) giữa các token JSON
      expect(canonical).not.toContain('": ');
      expect(canonical).not.toContain('", ');
    });

    it("cùng nội dung luôn ra cùng một chuỗi chuẩn hóa", () => {
      const c1 = canonicalizeContract(sampleInput);
      const c2 = canonicalizeContract({ ...sampleInput });
      expect(c1).toBe(c2);
    });

    it("chuẩn hóa CRLF và CR về LF ('\\n')", () => {
      const inputCRLF: CanonicalContractInput = {
        ...sampleInput,
        terms_text: "Dòng 1\r\nDòng 2\r\nDòng 3",
      };
      const inputLF: CanonicalContractInput = {
        ...sampleInput,
        terms_text: "Dòng 1\nDòng 2\nDòng 3",
      };

      const c1 = canonicalizeContract(inputCRLF);
      const c2 = canonicalizeContract(inputLF);
      expect(c1).toBe(c2);
    });

    it("chuẩn hóa Unicode NFC (tổ hợp vs dựng sẵn)", () => {
      // 'Phòng 301' dựng sẵn (NFC) vs 'Phòng 301' dạng tổ hợp (NFD)
      const nfcString = "Phòng 301 - Tòa nhà Sunshine";
      const nfdString = nfcString.normalize("NFD");

      const input1: CanonicalContractInput = { ...sampleInput, room_label: nfcString };
      const input2: CanonicalContractInput = { ...sampleInput, room_label: nfdString };

      const c1 = canonicalizeContract(input1);
      const c2 = canonicalizeContract(input2);
      expect(c1).toBe(c2);
    });
  });

  describe("saltedHash", () => {
    it("cùng nội dung và cùng salt luôn ra cùng một hash SHA-256", () => {
      const salt = newSalt();
      const canonical = canonicalizeContract(sampleInput);

      const h1 = saltedHash(salt, canonical);
      const h2 = saltedHash(salt, canonical);

      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("đổi một ký tự ra hash hoàn toàn khác", () => {
      const salt = newSalt();
      const canonical1 = canonicalizeContract(sampleInput);

      const modifiedInput: CanonicalContractInput = {
        ...sampleInput,
        due_day: 6, // Đổi từ 5 thành 6
      };
      const canonical2 = canonicalizeContract(modifiedInput);

      const h1 = saltedHash(salt, canonical1);
      const h2 = saltedHash(salt, canonical2);

      expect(h1).not.toBe(h2);
    });

    it("đổi salt ra hash hoàn toàn khác", () => {
      const s1 = newSalt();
      const s2 = newSalt();
      const canonical = canonicalizeContract(sampleInput);

      const h1 = saltedHash(s1, canonical);
      const h2 = saltedHash(s2, canonical);

      expect(h1).not.toBe(h2);
    });

    it("báo lỗi nếu salt không đủ 64 ký tự hex", () => {
      expect(() => saltedHash("tooshort", "data")).toThrow("Invalid salt length");
    });
  });

  describe("Helper Hash Functions", () => {
    it("hashDoc, hashReason, hashPaymentRef hoạt động chính xác", () => {
      const salt = newSalt();
      const doc = canonicalizeContract(sampleInput);
      const docH = hashDoc(salt, doc);
      expect(docH).toMatch(/^[0-9a-f]{64}$/);

      const reasonH1 = hashReason(salt, "Hỏng điều hòa\r\nCần sửa chữa");
      const reasonH2 = hashReason(salt, "Hỏng điều hòa\nCần sửa chữa");
      expect(reasonH1).toBe(reasonH2);

      const payH = hashPaymentRef(salt, "PAYOS", 123456789);
      expect(payH).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
