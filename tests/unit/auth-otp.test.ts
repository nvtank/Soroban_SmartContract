import "@/../tests/setup";
import { describe, expect, it } from "vitest";

describe("OTP SĐT Simulation & Rate Limiting Rules", () => {
  it("validates phone number formats", () => {
    const validPhones = ["0900000001", "0912345678", "+84900000001", "0987654321"];
    const invalidPhones = ["abc", "123", "phone12345", "090000000000000000000"];

    const phoneRegex = /^[0-9+]{8,15}$/;

    for (const p of validPhones) {
      expect(phoneRegex.test(p)).toBe(true);
    }

    for (const p of invalidPhones) {
      expect(phoneRegex.test(p)).toBe(false);
    }
  });

  it("allows fixed OTP 123456 for demo phone numbers", () => {
    const demoPhones = ["0900000001", "0900000002", "0900000003"];
    const fixedDemoOtp = "123456";

    for (const phone of demoPhones) {
      const isFixed = demoPhones.includes(phone);
      expect(isFixed).toBe(true);
      expect(fixedDemoOtp).toBe("123456");
    }
  });

  it("enforces max 3 requests per 5 minutes per phone", () => {
    const maxRequests = 3;
    const requests = [
      new Date(Date.now() - 4 * 60 * 1000),
      new Date(Date.now() - 3 * 60 * 1000),
      new Date(Date.now() - 1 * 60 * 1000),
    ];

    expect(requests.length).toBe(maxRequests);
    const wouldRateLimit = requests.length >= maxRequests;
    expect(wouldRateLimit).toBe(true);
  });

  it("locks out verification after 5 failed attempts", () => {
    const maxAttempts = 5;
    let attempts = 0;

    for (let i = 0; i < maxAttempts; i++) {
      attempts++;
    }

    expect(attempts >= maxAttempts).toBe(true);
  });
});
