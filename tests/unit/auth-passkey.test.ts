import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { getWebAuthnConfig } from "@/lib/crypto/passkey";

describe("Passkey WebAuthn Configuration & RP Details", () => {
  it("provides valid WebAuthn relying party configuration", () => {
    const config = getWebAuthnConfig();

    expect(config.rpName).toBeDefined();
    expect(config.rpID).toBeDefined();
    expect(config.origin).toBeDefined();

    expect(typeof config.rpName).toBe("string");
    expect(typeof config.rpID).toBe("string");
    expect(typeof config.origin).toBe("string");
    expect(config.origin.startsWith("http://") || config.origin.startsWith("https://")).toBe(true);
  });
});
