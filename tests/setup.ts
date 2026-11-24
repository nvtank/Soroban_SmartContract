import fs from "fs";
import path from "path";

// 1. Polyfill Map.groupBy and Object.groupBy for Node 20
if (typeof (Map as unknown as Record<string, unknown>).groupBy !== "function") {
  (Map as unknown as Record<string, unknown>).groupBy = function <K, T>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K,
  ): Map<K, T[]> {
    const map = new Map<K, T[]>();
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      const group = map.get(key);
      if (!group) {
        map.set(key, [item]);
      } else {
        group.push(item);
      }
    }
    return map;
  };
}

if (typeof (Object as unknown as Record<string, unknown>).groupBy !== "function") {
  (Object as unknown as Record<string, unknown>).groupBy = function <K extends PropertyKey, T>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K,
  ): Record<K, T[]> {
    const obj = {} as Record<K, T[]>;
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      if (!obj[key]) {
        obj[key] = [item];
      } else {
        obj[key].push(item);
      }
    }
    return obj;
  };
}

// Polyfill globalThis.WebSocket for Node 20 if needed
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = class MockWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

// 2. Load .env.local into process.env if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        // Remove surrounding quotes if any
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // Ignore
}
