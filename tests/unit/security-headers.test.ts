import { describe, expect, it } from "vitest";
import nextConfig from "@/../next.config";

describe("Security Headers in next.config.ts", () => {
  it("defines security headers for all routes", async () => {
    expect(nextConfig.headers).toBeDefined();
    const headersConfig = await nextConfig.headers!();

    expect(Array.isArray(headersConfig)).toBe(true);
    expect(headersConfig.length).toBeGreaterThan(0);

    const rootRule = headersConfig.find((r) => r.source === "/(.*)");
    expect(rootRule).toBeDefined();

    const headersMap = new Map<string, string>();
    for (const h of rootRule!.headers) {
      headersMap.set(h.key, h.value);
    }

    // 1. Content-Security-Policy
    const csp = headersMap.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-eval' 'unsafe-inline'"); // GSAP & Next.js support
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self' https: wss:");
    expect(csp).toContain("frame-ancestors 'none'");

    // 2. X-Content-Type-Options
    expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");

    // 3. Referrer-Policy
    expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

    // 4. X-Frame-Options
    expect(headersMap.get("X-Frame-Options")).toBe("DENY");

    // 5. Permissions-Policy
    const permPolicy = headersMap.get("Permissions-Policy");
    expect(permPolicy).toBeDefined();
    expect(permPolicy).toContain("camera=()");
    expect(permPolicy).toContain("microphone=()");
    expect(permPolicy).toContain("geolocation=()");
  });
});
