import { describe, it, expect } from "vitest";
import { containsPii, assertNoPii, sanitizeError } from "@/lib/stellar/pii";
import { ApiError } from "@/lib/api/http";

describe("Stellar PII Guard & Sanitizer", () => {
  describe("containsPii & assertNoPii", () => {
    it("cho phép payload sạch chỉ chứa ID, hash và số tiền", () => {
      const cleanPayload = {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        landlord: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        tenant: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2GFFPXVRVUQVVNPWUYGUS",
        doc_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        deposit: "10000000",
        rent: "5000000",
        due_day: 5,
        late_fee_bps_per_day: 50,
      };

      expect(containsPii(cleanPayload).hasPii).toBe(false);
      expect(() => assertNoPii(cleanPayload)).not.toThrow();
    });

    it("chặn khóa chứa tên cá nhân", () => {
      const dirty = { name: "Nguyễn Văn A" };
      expect(containsPii(dirty).hasPii).toBe(true);
      expect(() => assertNoPii(dirty)).toThrow(ApiError);
    });

    it("chặn khóa chứa số điện thoại hoặc trường phone", () => {
      const dirty1 = { phone: "0901234567" };
      const dirty2 = { args: { sdt: "0901234567" } };
      expect(containsPii(dirty1).hasPii).toBe(true);
      expect(containsPii(dirty2).hasPii).toBe(true);
    });

    it("chặn giá trị xâu chứa số điện thoại Việt Nam", () => {
      const dirty = { note: "Liên hệ 0912345678 để xem nhà" };
      expect(containsPii(dirty).hasPii).toBe(true);
    });

    it("chặn giá trị xâu chứa địa chỉ email", () => {
      const dirty = { contact: "nguyen.van.a@example.com" };
      expect(containsPii(dirty).hasPii).toBe(true);
    });

    it("chặn số CCCD 12 số hoặc CMND 9 số", () => {
      const dirty1 = { cccd: "001234567890" };
      const dirty2 = { id_number: "001234567890" };
      expect(containsPii(dirty1).hasPii).toBe(true);
      expect(containsPii(dirty2).hasPii).toBe(true);
    });

    it("chặn các trường văn bản tự do: room_label, terms_text, reason_text", () => {
      expect(containsPii({ room_label: "Phòng 301" }).hasPii).toBe(true);
      expect(containsPii({ terms_text: "Điều khoản hợp đồng" }).hasPii).toBe(true);
      expect(containsPii({ reason_text: "Khấu trừ tiền vệ sinh" }).hasPii).toBe(true);
    });

    it("chặn văn bản tự do dài không phải hash", () => {
      const longText = "Đây là một đoạn văn bản rất dài mô tả chi tiết lý do mà chủ nhà đưa ra...";
      expect(containsPii({ data: longText }).hasPii).toBe(true);
    });
  });

  describe("sanitizeError", () => {
    it("xóa sạch secret key Stellar (S...)", () => {
      const raw = "Error with key SCQXYZAAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKKLLLMMMNNNOOOPPPQQQ";
      const sanitized = sanitizeError(raw);
      expect(sanitized).not.toContain("SCQXYZAAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKKLLLMMMNNNOOOPPPQQQ");
      expect(sanitized).toContain("[REDACTED_SECRET]");
    });

    it("chuẩn hóa các mã lỗi Soroban theo enum sang tiếng Việt", () => {
      expect(sanitizeError("HostError: Error(Contract, #7)")).toBe(
        "Trạng thái hợp đồng trên blockchain không cho phép thao tác này.",
      );
      expect(sanitizeError("Transaction failed: DepositMismatch")).toBe(
        "Số tiền nạp cọc không khớp với số tiền đã thỏa thuận.",
      );
      expect(sanitizeError("Error(Contract, #13)")).toBe(
        "Hợp đồng đang có tranh chấp trên blockchain, các thao tác giải ngân bị khóa.",
      );
      expect(sanitizeError("Error(Contract, #17)")).toBe(
        "Mã tham chiếu thanh toán đã được ghi nhận trước đó trên blockchain.",
      );
      expect(sanitizeError("HostError: DuplicatePaymentRef")).toBe(
        "Mã tham chiếu thanh toán đã được ghi nhận trước đó trên blockchain.",
      );
      expect(sanitizeError("Error(Contract, #18)")).toBe(
        "Chủ nhà và người thuê không được là cùng một tài khoản.",
      );
      expect(sanitizeError("HostError: SamePartyNotAllowed")).toBe(
        "Chủ nhà và người thuê không được là cùng một tài khoản.",
      );
    });

    it("rút ngắn thông báo lỗi nếu quá dài", () => {
      const longErr = "A".repeat(400);
      const sanitized = sanitizeError(longErr);
      expect(sanitized.length).toBeLessThanOrEqual(250);
      expect(sanitized.endsWith("…")).toBe(true);
    });
  });
});
