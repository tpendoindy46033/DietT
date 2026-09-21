import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist-frontend"),
    emptyOutDir: true,
    sourcemap: false
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@frontend": resolve(__dirname, "src/frontend")
    }
  }
});
