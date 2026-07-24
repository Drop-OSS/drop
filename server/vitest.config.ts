import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // Nuxt env init is slow; default 5s is too short
    testTimeout: 30000,
    // Isolate Nuxt env + Prisma singleton per-worker to prevent cross-test state leak
    pool: "forks",
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
