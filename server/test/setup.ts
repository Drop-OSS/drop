// Vitest setup file — referenced by vitest.config.ts as setupFiles.
// Exists to unblock `pnpm --filter drop test` even when there are zero
// test files in the repo (Vitest still loads setup before --passWithNoTests).
//
// Sets DATABASE_URL to the docker-compose.test.yml postgres (port 5433)
// so any Phase-2 test that hits Prisma has a datasource to connect to.
// Vitest's env-isolation: this file runs per-worker due to `pool: "forks"`.

process.env.DATABASE_URL ??=
  "postgresql://drop_test:drop_test@localhost:5433/drop_test";
process.env.NODE_ENV ??= "test";
