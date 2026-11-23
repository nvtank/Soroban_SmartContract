import crypto from "crypto";
import { Keypair } from "@stellar/stellar-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/http";

function getMasterKey(): Buffer {
  const raw = process.env.CUSTODY_MASTER_KEY;
  if (!raw) {
    throw new Error("CUSTODY_MASTER_KEY environment variable is not set");
  }

  // Base64 32 bytes
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;

  // Hex 32 bytes
  const hex = Buffer.from(raw, "hex");
  if (hex.length === 32) return hex;

  // Fallback: SHA-256 hash to 32 bytes
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(secret: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encryptedData = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

  return decrypted.toString("utf8");
}

export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  const friendbotBase = process.env.STELLAR_FRIENDBOT_URL || "https://friendbot.stellar.org";
  try {
    const res = await fetch(`${friendbotBase}?addr=${encodeURIComponent(publicKey)}`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.warn("[custody] Friendbot funding warning:", err instanceof Error ? err.name : "request_failed");
    return false;
  }
}

export async function createCustodyWallet(
  db: SupabaseClient,
  userId: string,
): Promise<{ publicKey: string }> {
  // Check if wallet already exists
  const { data: existing } = await db
    .from("custody_wallets")
    .select("stellar_public_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return { publicKey: existing.stellar_public_key };
  }

  // Generate new keypair
  const pair = Keypair.random();
  const secret = pair.secret();
  const publicKey = pair.publicKey();

  const encryptedSecret = encryptSecret(secret);
  const keyVersion = parseInt(process.env.CUSTODY_KEY_VERSION || "1", 10);

  const { error } = await db.from("custody_wallets").insert({
    user_id: userId,
    stellar_public_key: publicKey,
    encrypted_secret: encryptedSecret,
    key_version: keyVersion,
  });

  if (error) {
    throw new ApiError("INTERNAL_ERROR", undefined, "Không thể tạo ví custody");
  }

  // Fund with Friendbot asynchronously in background
  void fundWithFriendbot(publicKey).catch(() => false);

  return { publicKey };
}

export async function getCustodyPublicKey(
  db: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await db
    .from("custody_wallets")
    .select("stellar_public_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy ví custody");
  }

  return data.stellar_public_key;
}

export async function withCustodyKeypair<T>(
  db: SupabaseClient,
  userId: string,
  fn: (keypair: Keypair) => Promise<T>,
): Promise<T> {
  const { data, error } = await db
    .from("custody_wallets")
    .select("encrypted_secret")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.encrypted_secret) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy khóa ví custody");
  }

  const secret = decryptSecret(data.encrypted_secret);
  const keypair = Keypair.fromSecret(secret);

  try {
    return await fn(keypair);
  } finally {
    // Secret is garbage collected in memory
  }
}
