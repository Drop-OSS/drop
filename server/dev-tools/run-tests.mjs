#!/usr/bin/env node
/**
 * Minimal unit-test runner for the server package.
 *
 * Drop server code uses Nuxt path aliases (`~` → server root) and node:test.
 * There is no test runner wired into the toolchain, so every `*.test.ts` file
 * is executed through jiti with that alias configured. Each file runs in its
 * own child process so failures are isolated and exit codes propagate.
 *
 * Usage: `pnpm --filter drop run test` (or `node dev-tools/run-tests.mjs`).
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Resolve jiti's JS entry point (the `.bin` shim is a shell script and cannot
// be executed as a Node module). Falls back to the hoisted root install.
function resolveJitiCli() {
  const require = createRequire(import.meta.url);
  try {
    return path.join(
      path.dirname(require.resolve("jiti/package.json")),
      "lib",
      "jiti-cli.mjs",
    );
  } catch {
    return path.resolve(
      serverRoot,
      "..",
      "node_modules",
      "jiti",
      "lib",
      "jiti-cli.mjs",
    );
  }
}

const jitiCli = resolveJitiCli();
const IGNORED_DIRS = new Set([
  "node_modules",
  ".nuxt",
  ".data",
  ".output",
  "dist",
  "build",
]);
const TEST_SUFFIX = ".test.ts";

function discover(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      found.push(...discover(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(TEST_SUFFIX)) {
      found.push(path.join(dir, entry.name));
    }
  }
  return found;
}

const files = discover(serverRoot).sort();
if (files.length === 0) {
  console.error(`No ${TEST_SUFFIX} files found under ${serverRoot}`);
  process.exit(1);
}

const alias = JSON.stringify({ "~": serverRoot });
let failed = 0;

for (const file of files) {
  const rel = path.relative(serverRoot, file);
  console.log(`\n> ${rel}`);
  const result = spawnSync(process.execPath, [jitiCli, file], {
    cwd: serverRoot,
    stdio: "inherit",
    env: { ...process.env, JITI_ALIAS: alias },
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAILED: ${rel}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed === 0 ? 0 : 1);
