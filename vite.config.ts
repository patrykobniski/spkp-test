/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Produkcja na https://ux.dev-jaaqob.pl/spkp-test/
const PROD_BASE = "/spkp-test/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? PROD_BASE : "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
  },
}));
