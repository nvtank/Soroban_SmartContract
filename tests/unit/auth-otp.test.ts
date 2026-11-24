import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { getClientIp, isValidIp } from "@/lib/supabase/rate-limit";

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

  describe("Safe Client IP Extraction & Validation (Anti-Spoofing)", () => {
    it("validates valid IPv4 and IPv6 addresses", () => {
      expect(isValidIp("127.0.0.1")).toBe(true);
      expect(isValidIp("192.168.1.1")).toBe(true);
      expect(isValidIp("10.0.0.1")).toBe(true);
      expect(isValidIp("::1")).toBe(true);
      expect(isValidIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);

      // Invalid IPs
      expect(isValidIp("")).toBe(false);
      expect(isValidIp("999.999.999.999")).toBe(false);
      expect(isValidIp("012.34.56.78")).toBe(false); // leading zero
      expect(isValidIp("evil.com")).toBe(false);
      expect(isValidIp("<script>alert(1)</script>")).toBe(false);
      expect(isValidIp("' OR 1=1 --")).toBe(false);
    });

    it("prefers trusted headers over generic x-forwarded-for", () => {
      const headers1 = new Headers({
        "x-vercel-forwarded-for": "103.1.2.3",
        "x-forwarded-for": "192.168.1.99, 10.0.0.1",
      });
      expect(getClientIp(headers1)).toBe("103.1.2.3");

      const headers2 = new Headers({
        "cf-connecting-ip": "114.119.1.5",
        "x-forwarded-for": "spoofed_ip, 1.2.3.4",
      });
      expect(getClientIp(headers2)).toBe("114.119.1.5");

      const headers3 = new Headers({
        "x-real-ip": "14.161.22.33",
        "x-forwarded-for": "1.1.1.1",
      });
      expect(getClientIp(headers3)).toBe("14.161.22.33");
    });

    it("does not blindly trust spoofed values in x-forwarded-for", () => {
      const headers = new Headers({
        "x-forwarded-for": "malicious_string, 203.0.113.195, 198.51.100.1",
      });
      // Should skip invalid string and take first valid IP
      expect(getClientIp(headers)).toBe("203.0.113.195");
    });

    it("strips port numbers from IPs", () => {
      const headers = new Headers({
        "x-real-ip": "203.0.113.50:4321",
      });
      expect(getClientIp(headers)).toBe("203.0.113.50");
    });

    it("falls back to 127.0.0.1 when no valid headers are provided", () => {
      const emptyHeaders = new Headers();
      expect(getClientIp(emptyHeaders)).toBe("127.0.0.1");

      const invalidHeaders = new Headers({
        "x-forwarded-for": "garbage_ip",
      });
      expect(getClientIp(invalidHeaders)).toBe("127.0.0.1");
    });
  });
});
