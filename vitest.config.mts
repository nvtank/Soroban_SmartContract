import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import "./tests/polyfill.js";

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./tests/polyfill.js", "./tests/setup.ts", "./tests/safety.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});
