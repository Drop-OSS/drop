import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["server/**/*.ts"],
      exclude: ["server/test/**", "server/**/*.test.ts"],
    },
    setupFiles: ["./test/setup.ts"],
  },
});
