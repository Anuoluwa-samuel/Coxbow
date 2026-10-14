import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const alias = {
  "@": path.resolve(__dirname, "src"),
  // `server-only` throws outside Next's server bundle; neutralise it for tests.
  "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          fileParallelism: false, // tests share one database
          testTimeout: 30_000,
          env: {
            DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
            APP_SECRET: "test-secret-test-secret-test-secret-123456",
          },
        },
      },
    ],
  },
});
