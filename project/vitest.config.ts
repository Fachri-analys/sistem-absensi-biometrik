import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Unit test (src/**) dan integration test (tests/integration/**) dipisah
    // via script npm yang berbeda (lihat package.json test:unit vs
    // test:integration) — unit test TIDAK boleh butuh Docker/DB apa pun,
    // integration test BOLEH lambat karena benar-benar spin up container.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30000, // integration test (Testcontainers) butuh waktu start container
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
