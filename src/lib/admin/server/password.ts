import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);

export function demoAdminPasswordConfig() {
  if (process.env.DEMO_MODE !== "true") return null;
  const match = /^([0-9a-f]{32}):([0-9a-f]{64})$/i.exec(process.env.DEMO_ADMIN_PASSWORD_HASH ?? "");
  return match ? { salt: Buffer.from(match[1], "hex"), hash: Buffer.from(match[2], "hex") } : null;
}

export async function matchesDemoAdminPassword(
  config: NonNullable<ReturnType<typeof demoAdminPasswordConfig>>,
  password: string,
) {
  const candidate = (await derive(password, config.salt, config.hash.length)) as Buffer;
  return timingSafeEqual(candidate, config.hash);
}
