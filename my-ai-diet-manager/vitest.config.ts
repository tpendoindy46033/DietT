import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: false,
    testTimeout: 15000
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@worker": resolve(__dirname, "src/worker"),
      "@frontend": resolve(__dirname, "src/frontend")
    }
  }
});
