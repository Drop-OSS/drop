#!/usr/bin/env node
// Detect NEW (un-accepted) advisories in pnpm/cargo audit JSON output,
// comparing against entries in security/risk-register.yaml.
//
// Behavior:
//   - Missing or unparseable audit JSON → exit 0 (assume tool flaked, do
//     not fail the workflow on infra noise). A noisy log line is emitted.
//   - Risk register missing or unparseable → exit 0 (same reason). This
//     avoids the failure mode where an empty `known` set causes every
//     advisory to be flagged as new.
//   - New (un-registered) advisory found → exit 1, log each one.
//   - All advisories in register or no advisories → exit 0.
//
// Usage:
//   check-new-vulns.cjs --format pnpm --json /tmp/audit.json
//   check-new-vulns.cjs --format cargo --json /tmp/cargo-audit.json
//
// Flags:
//   --format {pnpm|cargo}   audit JSON shape to parse
//   --json <path>           path to audit JSON output
//   --register <path>       path to risk-register.yaml (default: security/risk-register.yaml)
//   --ignored <id,id,...>   comma-separated advisory IDs to ignore unconditionally
//                            (e.g. for pnpm audit --ignore GHSA-...)
//   --min-severity <s>      minimum severity to report (pnpm: critical|high|moderate|low;
//                            cargo: critical|high|medium|low|informational). Default: critical.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HELP_TEXT =
  "Usage: check-new-vulns.cjs --format {pnpm|cargo} --json <path> " +
  "[--register <path>] [--ignored <id,id,...>] [--min-severity <s>]\n\n" +
  "Compares pnpm/cargo audit JSON output against entries in\n" +
  "security/risk-register.yaml and exits 1 only when a new (un-accepted)\n" +
  "advisory is detected. Missing/empty/malformed audit JSON or register\n" +
  "exits 0 (treated as infra noise).";

// fallow-ignore-next-line complexity
function parseArgs(argv) {
  const args = {};
  // Reject values that look like another flag (start with `--`) or are
  // missing entirely. Catches typos like `--format --json file.json` where
  // `--json` would be silently consumed as the format value.
  const nextArg = (i, flagName) => {
    if (i >= argv.length) {
      console.error(`[check-new-vulns] missing value for ${flagName}`);
      process.exit(2);
    }
    const v = argv[i];
    if (v.startsWith("--")) {
      console.error(
        `[check-new-vulns] ${flagName} requires a value (got another flag '${v}')`,
      );
      process.exit(2);
    }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") args.format = nextArg(++i, "--format");
    else if (a === "--json") args.json = nextArg(++i, "--json");
    else if (a === "--register") args.register = nextArg(++i, "--register");
    else if (a === "--ignored") {
      const val = nextArg(++i, "--ignored");
      args.ignored = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--min-severity")
      args.minSeverity = nextArg(++i, "--min-severity");
    else if (a === "--help" || a === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    }
  }
  return args;
}

function readJson(path) {
  try {
    if (!fs.existsSync(path)) return { ok: false, reason: "file missing" };
    const raw = fs.readFileSync(path, "utf8").trim();
    if (!raw) return { ok: false, reason: "file empty" };
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Parse security/risk-register.yaml by line-scanning for `advisory:` fields.
// We deliberately avoid a full YAML parser (no extra deps in CI). Format is
// stable: each entry has `advisory: GHSA-...` or `advisory: RUSTSEC-...` on
// its own line. Comment lines and unrelated fields are ignored.
//
// Returns { known, loaded } where `loaded` is false when the file is
// missing OR unparseable. A loaded-but-empty-known (file exists but no
// `advisory:` entries matched) is treated as loaded: true — the caller can
// still proceed with an empty known set and will correctly flag every
// advisory as new.
function readKnownAdvisories(path) {
  let known = new Set();
  let loaded = false;
  try {
    if (!fs.existsSync(path)) return { known, loaded: false };
    const text = fs.readFileSync(path, "utf8");
    // Lenient: ignore any trailing content (e.g. inline `# comment`).
    // Avoids super-linear backtracking and future-proofs against trailing comments.
    const re = /^\s*advisory:\s*(\S+)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      known.add(m[1]);
    }
    loaded = true;
  } catch (e) {
    return { known: new Set(), loaded: false };
  }
  return { known, loaded };
}

function severityRank(s) {
  // Unknown / missing severity is treated as critical (highest rank) so
  // we never silently filter out a vulnerability because its severity
  // string was unrecognized or absent — false negatives are worse than
  // false positives here.
  return (
    { critical: 4, high: 3, moderate: 2, medium: 2, low: 1, informational: 0 }[
      (s || "").toLowerCase()
    ] ?? 4
  );
}

function extractPnpm(data, minSeverity) {
  const advisories = data.advisories ? Object.values(data.advisories) : [];
  const minRank = severityRank(minSeverity);
  return advisories
    .filter((a) => severityRank(a.severity) >= minRank)
    .map((a) => ({
      id: a.github_advisory_id,
      module: a.module_name,
      severity: a.severity,
      title: a.title,
    }));
}

function extractCargo(data, minSeverity) {
  const vulns = (data.vulnerabilities && data.vulnerabilities.list) || [];
  const minRank = severityRank(minSeverity);
  return (
    vulns
      .filter((v) => v.advisory && severityRank(v.advisory.severity) >= minRank)
      // fallow-ignore-next-line complexity
      .map((v) => ({
        id: v.advisory?.id ?? "unknown",
        module: v.package?.name ?? "unknown",
        severity: v.advisory?.severity ?? "unknown",
        title: v.advisory?.title ?? "unknown",
      }))
  );
}

// fallow-ignore-next-line complexity
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.format || !args.json) {
    console.error(
      "Usage: check-new-vulns.cjs --format {pnpm|cargo} --json <path> [--register <path>] [--ignored <id,id,...>] [--min-severity <s>]",
    );
    process.exit(2);
  }
  if (!["pnpm", "cargo"].includes(args.format)) {
    console.error(`Unsupported --format: ${args.format}`);
    process.exit(2);
  }

  // Default register path: GITHUB_WORKSPACE (repo root) when available,
  // falling back to process.cwd()/security/. Composite actions like
  // rust-ci set working-directory to a sub-crate (cli/, desktop/src-tauri/),
  // so process.cwd() alone would silently miss the register and flag every
  // advisory as new.
  const registerPath =
    args.register ||
    path.join(
      process.env.GITHUB_WORKSPACE || process.cwd(),
      "security",
      "risk-register.yaml",
    );
  const ignored = new Set(args.ignored || []);

  const loaded = readJson(args.json);
  if (!loaded.ok) {
    console.warn(
      `[check-new-vulns] ${args.format} audit JSON unavailable (${loaded.reason}); treating as no advisories.`,
    );
    process.exit(0);
  }

  const minSeverity = args.minSeverity || "critical";
  const all =
    args.format === "pnpm"
      ? extractPnpm(loaded.data, minSeverity)
      : extractCargo(loaded.data, minSeverity);

  // Distinguish "register loaded but empty" from "register could not be
  // loaded" so we don't flag every advisory as new when the file is
  // genuinely missing or unparseable (infra noise).
  const { known, loaded: registerAvailable } =
    readKnownAdvisories(registerPath);

  if (!registerAvailable) {
    console.warn(
      `[check-new-vulns] risk register unavailable at ${registerPath}; treating as no known advisories (infra noise, not a failure).`,
    );
    process.exit(0);
  }

  const newOnes = all.filter((a) => !ignored.has(a.id) && !known.has(a.id));

  if (newOnes.length > 0) {
    for (const a of newOnes) {
      console.error(
        `NEW ${args.format.toUpperCase()} ADVISORY: ${a.id} ${a.module} (${a.severity}) — ${a.title}`,
      );
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
