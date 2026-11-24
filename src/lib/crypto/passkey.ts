import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/http";

export function getWebAuthnConfig() {
  const rpName = process.env.WEBAUTHN_RP_NAME || "RentFlow";
  const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
  const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

  return { rpName, rpID, origin };
}

export async function createPasskeyRegistrationOptions(
  db: SupabaseClient,
  userId: string,
  userPhone: string,
) {
  const { rpName, rpID } = getWebAuthnConfig();

  // Get existing credentials to exclude
  const { data: existingCreds } = await db
    .from("passkey_credentials")
    .select("credential_id")
    .eq("user_id", userId);

  const excludeCredentials = existingCreds?.map((c) => ({
    id: c.credential_id,
    transports: ["internal", "hybrid"] as AuthenticatorTransport[],
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: isoUint8Array.fromUTF8String(userId),
    userName: userPhone || `user-${userId.slice(0, 8)}`,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Save challenge to db with 5 min expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await db.from("auth_challenges").insert({
    user_id: userId,
    challenge: options.challenge,
    type: "PASSKEY_REGISTRATION",
    expires_at: expiresAt,
  });

  return options;
}

export async function verifyPasskeyRegistration(
  db: SupabaseClient,
  userId: string,
  response: any,
): Promise<VerifiedRegistrationResponse> {
  const { rpID, origin } = getWebAuthnConfig();

  // Extract client challenge from clientDataJSON to prevent replay and cross-session mismatch
  let clientChallenge: string | undefined;
  if (response?.response?.clientDataJSON) {
    try {
      const parsed = JSON.parse(
        Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
      );
      clientChallenge = parsed.challenge;
    } catch {
      // Ignored
    }
  }

  let query = db
    .from("auth_challenges")
    .select("id, challenge, expires_at")
    .eq("user_id", userId)
    .eq("type", "PASSKEY_REGISTRATION")
    .gt("expires_at", new Date().toISOString());

  if (clientChallenge) {
    query = query.eq("challenge", clientChallenge);
  }

  const { data: challengeRow } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Thử thách Passkey đã hết hạn hoặc không hợp lệ.");
  }

  // Atomically delete/consume challenge to prevent replay
  await db.from("auth_challenges").delete().eq("id", challengeRow.id);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Không thể xác thực thông tin đăng ký Passkey.");
  }

  const { credential } = verification.registrationInfo;
  const credentialID = credential.id;
  const publicKey = Buffer.from(credential.publicKey).toString("base64url");
  const counter = credential.counter;
  const transports = response.response?.transports || [];

  // Save credential
  await db.from("passkey_credentials").insert({
    user_id: userId,
    credential_id: credentialID,
    public_key: publicKey,
    counter: counter,
    transports: transports,
  });

  return verification;
}

export async function createPasskeyAuthOptions(
  db: SupabaseClient,
  userId?: string,
) {
  const { rpID } = getWebAuthnConfig();

  let allowCredentials;
  if (userId) {
    const { data: creds } = await db
      .from("passkey_credentials")
      .select("credential_id, transports")
      .eq("user_id", userId);

    if (creds && creds.length > 0) {
      allowCredentials = creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports || ["internal"]) as AuthenticatorTransport[],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await db.from("auth_challenges").insert({
    user_id: userId || null,
    challenge: options.challenge,
    type: "PASSKEY_AUTH",
    expires_at: expiresAt,
  });

  return options;
}

export async function verifyPasskeyAuth(
  db: SupabaseClient,
  response: any,
): Promise<{ verified: boolean; userId: string }> {
  const { rpID, origin } = getWebAuthnConfig();

  const credentialID = response.id;
  if (!credentialID) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Mã định danh Passkey không hợp lệ.");
  }

  const { data: cred } = await db
    .from("passkey_credentials")
    .select("id, user_id, credential_id, public_key, counter")
    .eq("credential_id", credentialID)
    .maybeSingle();

  if (!cred) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy Passkey đã đăng ký.");
  }

  // Extract client challenge from clientDataJSON
  let clientChallenge: string | undefined;
  if (response?.response?.clientDataJSON) {
    try {
      const parsed = JSON.parse(
        Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
      );
      clientChallenge = parsed.challenge;
    } catch {
      // Ignored
    }
  }

  let query = db
    .from("auth_challenges")
    .select("id, challenge, expires_at")
    .eq("type", "PASSKEY_AUTH")
    .gt("expires_at", new Date().toISOString());

  if (clientChallenge) {
    query = query.eq("challenge", clientChallenge);
  }

  const { data: challengeRow } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Thử thách Passkey đã hết hạn hoặc không hợp lệ.");
  }

  // Atomically delete/consume challenge to prevent replay
  await db.from("auth_challenges").delete().eq("id", challengeRow.id);

  const publicKeyBuffer = Buffer.from(cred.public_key, "base64url");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: cred.credential_id || credentialID,
      publicKey: new Uint8Array(publicKeyBuffer),
      counter: Number(cred.counter),
    },
  });

  if (!verification.verified) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Xác thực Passkey thất bại.");
  }

  // Counter check: if credential counter > 0, new counter MUST be strictly greater
  const currentCounter = Number(cred.counter);
  const newCounter = verification.authenticationInfo.newCounter;

  if (currentCounter > 0 && newCounter <= currentCounter) {
    throw new ApiError(
      "UNAUTHENTICATED",
      undefined,
      "Phát hiện bất thường về counter của Passkey (nguy cơ bị sao chép hoặc replay).",
    );
  }

  // Update counter
  await db
    .from("passkey_credentials")
    .update({ counter: newCounter })
    .eq("id", cred.id);

  return { verified: true, userId: cred.user_id };
}
