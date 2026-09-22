import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./tests/support/empty.ts", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") },
  },
  test: { environment: "node", include: ["tests/*.test.ts"] },
});
