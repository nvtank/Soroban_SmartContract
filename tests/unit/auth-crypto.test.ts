import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { encryptSecret, decryptSecret } from "@/lib/crypto/custody";

describe("Custody Secret Encryption (AES-256-GCM)", () => {
  it("encrypts and decrypts a Stellar secret key successfully", () => {
    const pair = Keypair.random();
    const originalSecret = pair.secret();

    const encrypted = encryptSecret(originalSecret);
    expect(encrypted).not.toBe(originalSecret);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(originalSecret);

    const reconstructedPair = Keypair.fromSecret(decrypted);
    expect(reconstructedPair.publicKey()).toBe(pair.publicKey());
  });

  it("produces non-deterministic ciphertexts due to random IV", () => {
    const pair = Keypair.random();
    const secret = pair.secret();

    const enc1 = encryptSecret(secret);
    const enc2 = encryptSecret(secret);

    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1)).toBe(secret);
    expect(decryptSecret(enc2)).toBe(secret);
  });

  it("fails to decrypt if ciphertext is corrupted or tampered with", () => {
    const pair = Keypair.random();
    const secret = pair.secret();
    const encrypted = encryptSecret(secret);

    const [iv, tag, data] = encrypted.split(":");
    // Tamper with data
    const corruptedData = (data.startsWith("aa") ? "bb" : "aa") + data.slice(2);
    const tamperedPayload = `${iv}:${tag}:${corruptedData}`;

    expect(() => decryptSecret(tamperedPayload)).toThrow();
  });

  it("fails to decrypt if auth tag is modified", () => {
    const pair = Keypair.random();
    const secret = pair.secret();
    const encrypted = encryptSecret(secret);

    const [iv, tag, data] = encrypted.split(":");
    const corruptedTag = (tag.startsWith("ff") ? "00" : "ff") + tag.slice(2);
    const tamperedPayload = `${iv}:${corruptedTag}:${data}`;

    expect(() => decryptSecret(tamperedPayload)).toThrow();
  });

  it("fails on invalid payload format", () => {
    expect(() => decryptSecret("invalid-payload-without-colons")).toThrow("Invalid encrypted payload format");
  });
});
