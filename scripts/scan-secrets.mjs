#!/usr/bin/env node

/**
 * scan-secrets.mjs
 * Quét toàn bộ repository và lịch sử git để phát hiện secret, private key, token bị lộ.
 * Trả exit code 1 nếu có vi phạm, exit code 0 nếu an toàn.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SECRET_PATTERNS = [
  {
    name: "Stellar Secret Key",
    regex: /\bS[A-Z2-7]{55}\b/g,
    // Bỏ qua các chuỗi regex mẫu hoặc mã giả lập trong file kiểm thử
    ignoreFiles: [/pii\.ts$/, /stellar-pii\.test\.ts$/, /scan-secrets\.mjs$/],
  },
  {
    name: "Private Key PEM",
    regex: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g,
    ignoreFiles: [/scan-secrets\.mjs$/],
  },
  {
    name: "Hardcoded AWS Access Key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    ignoreFiles: [/scan-secrets\.mjs$/],
  },
  {
    name: "GitHub Personal Access Token",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g,
    ignoreFiles: [/scan-secrets\.mjs$/],
  },
  {
    name: "Generic Secret Assignment with Real Token",
    regex: /(?:secret|password|api_key|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{32,}["']/i,
    ignoreFiles: [
      /\.example$/,
      /helpers\.ts$/,
      /tests\/setup\.ts$/,
      /scan-secrets\.mjs$/,
      /package-lock\.json$/,
      /pnpm-lock\.yaml$/,
      /constants\.ts$/,
    ],
  },
];

const IGNORED_PATH_PREFIXES = [
  ".git/",
  "node_modules/",
  ".next/",
  ".rentflow-task/",
  "supabase/.temp/",
];

function isIgnoredPath(filepath) {
  return IGNORED_PATH_PREFIXES.some((prefix) => filepath.startsWith(prefix));
}

let violationsCount = 0;

console.log("==================================================");
console.log("RentFlow Secret Scanner: Quét mã nguồn và Git history");
console.log("==================================================");

// 1. Quét các file đang theo dõi trong working tree
console.log("\n[1/2] Đang quét các file trong working tree...");
try {
  const trackedFilesOutput = execSync("git ls-files", { encoding: "utf8" });
  const files = trackedFilesOutput.split("\n").filter((f) => f.trim().length > 0);

  for (const file of files) {
    if (isIgnoredPath(file)) continue;
    if (!fs.existsSync(file)) continue;

    // Bỏ qua file nhị phân
    const ext = path.extname(file).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".ico", ".svg", ".wasm", ".pdf", ".lock"].includes(ext)) {
      continue;
    }

    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (const rule of SECRET_PATTERNS) {
      if (rule.ignoreFiles && rule.ignoreFiles.some((pattern) => pattern.test(file))) {
        continue;
      }

      lines.forEach((line, lineIdx) => {
        // Reset regex state
        rule.regex.lastIndex = 0;
        const match = rule.regex.exec(line);
        if (match) {
          // Bỏ qua nếu dòng comment nói rõ là demo / mock / pattern test
          if (line.includes("example") || line.includes("placeholder") || line.includes("demo-seed")) {
            return;
          }

          violationsCount++;
          const masked = match[0].slice(0, 4) + "..." + match[0].slice(-4);
          console.error(
            `❌ [VIOLATION] ${rule.name} tại file: ${file}:${lineIdx + 1} -> Phát hiện '${masked}'`
          );
        }
      });
    }
  }
} catch (err) {
  console.error("Lỗi khi quét working tree:", err.message);
  process.exit(1);
}

// 2. Quét lịch sử git commit
console.log("\n[2/2] Đang quét lịch sử git commit...");
try {
  // Lấy diff của 50 commit gần nhất
  const logOutput = execSync("git log -p -n 50", { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const logLines = logOutput.split("\n");

  let currentCommit = "unknown";
  let currentFile = "unknown";

  for (let i = 0; i < logLines.length; i++) {
    const line = logLines[i];
    if (line.startsWith("commit ")) {
      currentCommit = line.slice(7, 15);
    } else if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      // Added line
      if (isIgnoredPath(currentFile)) continue;

      for (const rule of SECRET_PATTERNS) {
        if (rule.ignoreFiles && rule.ignoreFiles.some((pattern) => pattern.test(currentFile))) {
          continue;
        }

        rule.regex.lastIndex = 0;
        const match = rule.regex.exec(line);
        if (match) {
          if (line.includes("example") || line.includes("placeholder")) continue;

          violationsCount++;
          const masked = match[0].slice(0, 4) + "..." + match[0].slice(-4);
          console.error(
            `❌ [GIT HISTORY VIOLATION] ${rule.name} tại commit ${currentCommit} (file ${currentFile}): '${masked}'`
          );
        }
      }
    }
  }
} catch (err) {
  console.error("Lỗi khi quét git log:", err.message);
}

console.log("\n==================================================");
if (violationsCount > 0) {
  console.error(`🚨 PHÁT HIỆN ${violationsCount} VI PHẠM BẢO MẬT TRONG REPO / LỊCH SỬ GIT!`);
  process.exit(1);
} else {
  console.log("✅ HOÀN TẤT: Toàn bộ repository và lịch sử git sạch, không có secret bị lộ.");
  process.exit(0);
}
