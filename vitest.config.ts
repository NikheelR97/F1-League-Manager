import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    server: {
      deps: {
        inline: ["@testing-library/jest-dom"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/e2e/**",
        "**/node_modules/**",
        // DB service layer — pure precondition logic tested; async DB paths tested via E2E
        "src/lib/results/publish-service.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    environment: "jsdom",
    exclude: ["**/e2e/**", "**/node_modules/**"],
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest", "./src/test/setup.ts"],
  },
});
