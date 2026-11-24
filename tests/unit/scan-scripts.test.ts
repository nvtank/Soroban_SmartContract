import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { execSync, spawnSync } from "child_process";
import path from "path";
import fs from "fs";

describe("Security Scanners: scripts/scan-secrets.mjs & scripts/scan-pii.mjs", () => {
  const rootDir = process.cwd();
  const scanSecretsPath = path.resolve(rootDir, "scripts/scan-secrets.mjs");
  const scanPiiPath = path.resolve(rootDir, "scripts/scan-pii.mjs");

  it("scripts/scan-secrets.mjs exits with code 0 on the clean repository", () => {
    const res = spawnSync("node", [scanSecretsPath], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("HOÀN TẤT: Toàn bộ repository và lịch sử git sạch");
  });

  it("scripts/scan-pii.mjs exits with code 0 on clean on-chain payloads", () => {
    const res = spawnSync("node", [scanPiiPath], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("HOÀN TẤT: Dữ liệu on-chain hoàn toàn sạch PII");
  });

  it("scripts/scan-secrets.mjs returns exit code 1 when a real secret violation is detected in tracked files", () => {
    // Create a temporary tracked dummy file with a leaked Stellar secret key (56 chars starting with S)
    const dummyFile = path.resolve(rootDir, "scripts/temp-leaked-secret.txt");
    const fakeStellarKey = "S" + "A".repeat(55); // 56 chars

    try {
      fs.writeFileSync(dummyFile, `STELLAR_SECRET=${fakeStellarKey}\n`);
      execSync(`git add "${dummyFile}"`);

      const res = spawnSync("node", [scanSecretsPath], {
        cwd: rootDir,
        encoding: "utf8",
      });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain("PHÁT HIỆN");
      expect(res.stderr).toContain("VI PHẠM BẢO MẬT");
    } finally {
      execSync(`git reset "${dummyFile}" 2>/dev/null || true`);
      if (fs.existsSync(dummyFile)) fs.unlinkSync(dummyFile);
    }
  });

  it("scripts/scan-pii.mjs returns exit code 1 when a payload containing PII is scanned", () => {
    const dirtyPayload = JSON.stringify({
      id: "10000000-0000-0000-0000-000000000001",
      phone: "0912345678",
      tenant_name: "Nguyễn Văn A",
    });

    const res = spawnSync("node", [scanPiiPath, dirtyPayload], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain("PHÁT HIỆN");
    expect(res.stderr).toContain("VI PHẠM PII TRÊN ON-CHAIN");
  });
});
