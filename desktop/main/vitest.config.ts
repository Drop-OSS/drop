import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~": rootDir,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
  },
});
