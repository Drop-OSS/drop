// lint-staged config — polyglot; runs only on staged files at pre-commit.
//
// Scope rule: prettier for web/JS/TS, cargo fmt --check for Rust (no auto-fix
// on commit; dev runs `cargo fmt` manually), shellcheck for shell. ESLint is
// intentionally NOT here — Nuxt3 type-aware rules load the full tsconfig
// regardless of staged subset, so lint-staged offers no timing win for eslint
// (the full-repo pnpm --filter drop lint command remains in pre-commit).
//
// Husky swap (see .husky/pre-commit): `pnpm --filter drop lint` replaced with
// `pnpm --filter drop lint-staged` so this config runs on staged files only.
export default {
  "*.{ts,js,vue,mjs,cjs,tsx,jsx}": "prettier --write",
  "*.{yml,yaml,json,md}": "prettier --write",
  "*.rs": (filepath) => {
    // File-level passthrough so cargo fmt --check runs on the changed crate only.
    // lint-staged passes the absolute path; derive `--manifest-path` from it.
    const normalized = filepath.replace(/\\/g, "/");
    const match = normalized.match(
      /^(.*\/)(torrential|cli|desktop\/src-tauri)(\/|$)/,
    );
    const crate = match ? match[2] : "torrential";
    return `cargo fmt --all --manifest-path ${crate}/Cargo.toml -- --check`;
  },
  "*.sh": "shellcheck --severity=warning",
};
