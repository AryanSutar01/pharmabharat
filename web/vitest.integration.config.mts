import { defineConfig } from "vitest/config";
import base from "./vitest.config.mts";

// Runs against a real MongoDB (MONGODB_URI from .env.local, database "pharmabharat_test").
export default defineConfig({
  resolve: base.resolve,
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/support/load-env.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
