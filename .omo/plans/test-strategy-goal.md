# Test Strategy Goal Prompt — Drop Monorepo

**Goal:** Prove BillyOutlast/drop can merge into Drop-OSS/drop without breaking,
then maintain 100% code coverage with automated test hooks.

**Generated:** 2026-07-25 via adversarial planning (hyperplan)
**Perspectives:** codebase-realist, security-hardener, integration-architect, creative-escaper

---

## 1. Givens (Reality Constraints)

| Constraint | Impact |
|---|---|
| **Prisma schema: 0 models** | All DB-dependent tests (~40% of server backend) blocked until schema defined |
| **Rust coverage: no tooling** | `cargo-llvm-cov` (or tarpaulin) must be added before any Rust coverage |
| **Tailscale FFI: CGo, no trait boundary** | Cannot unit-test — requires `trait TailscaleProvider` extraction first |
| **Current coverage: 1.17%** | 32 vitest + 10 cargo + 6 cargo + 1 Playwright = 49 tests total |
| **No upstream remote configured** | `git remote add upstream git@github.com:Drop-OSS/drop.git` is prerequisite |
| **4 workspaces with 0 tests** | `desktop/main/` (Nuxt 4), `sites/promo/` (Next.js), `sites/docs/` (Astro), `libraries/base/` |
| **169 API handlers, 71 internal modules, 72 Rust source files** | Scope is large — prioritization essential |

**Realistic 6-month target: 25-30% project-wide coverage.** 100% requires months of
solo-dev effort across schema definition, trait extraction, and 2000+ tests.

---

## 2. Threat Model & Security Test Priorities (P0 First)

### P0 — Must test before merge

**T1: WebAuthn attestation not validated**
- `parseAndValidatePasskeyCreation()` in `server/server/internal/auth/webauthn.ts`
- Validates challenge/RPID but NOT attestation signature
- **Test:** Crafted CBOR with arbitrary public key should be REJECTED
- **Or:** Document explicit gap if out of scope

**T2: OIDC group-to-admin escalation**
- `fetchOrCreateUser()` in `server/server/internal/auth/oidc/index.ts`
- If OIDC provider returns `adminGroup` for non-admin user → user created as admin
- **Test:** Mock OIDC returns adminGroup → verify user NOT created as admin

**T3: Session fixation**
- `signin()` reuses existing `drop-token` cookie if present
- **Test:** Pre-set cookie → signin → new session created, old one invalidated

**T4: ACL confused deputy**
- `allowSystemACL()` in `server/server/internal/acls/index.ts`
- Session exists but user is NOT admin + valid system token → falls through to token check
- **Test:** Non-admin with session + stolen system token → denied

### P1 — High priority

**T5: OIDC state replay**
- `signinStateTable` never GCs used states
- **Test:** Same `state` value replayed → rejected

**T6: CA blacklist footgun**
- `dbCertificateStore.checkBlacklistCertificate()` returns `true` for missing rows
- Deleted cert = "blacklisted" = denial of service
- **Test:** Missing cert ≠ blacklisted

**T7: TOTP code generation/verification**
- Zero tests for the actual TOTP flow (not just base64 encode/decode)
- **Test:** Secret → code generation → code verification round-trip

**T8: Notification ACL enforcement**
- `listen()` stores user-provided ACLs but never verifies caller possesses them
- **Test:** Register listener with `system:admin` ACL as non-admin → filtered

---

## 3. Architecture — Integration Seams That MUST Have Tests

### F1: API Route → Prisma (CRITICAL, affects ~100 handlers)
- **Problem:** Every route handler calls `prisma.game.create(...)` directly
- **Fix:** Extract `trait PrismaRepository` per domain (GameRepo, CompanyRepo, TagRepo)
- **What to test:**
  - Handler creates correct Prisma query shape (via InMemoryGameRepo)
  - Route returns correct HTTP status for each DB outcome (created, conflict, not-found)
  - Error responses do not leak internal state

### F2: Metadata Provider Chain Fallthrough (HIGH)
- **Problem:** 5 providers (IGDB, Steam, GiantBomb, PCGamingWiki, Manual) chained via PriorityListIndexed
- **Fix:** Inject mock providers (trait-level, not MSW HTTP-level)
- **What to test:**
  - Provider A fails → Provider B tries → Provider C succeeds → returns all successful
  - All providers fail → empty result, no crash
  - Provider timeout interleaving (Promise.allSettled + per-provider timeout)
  - Fuzzy sort correctness across multi-provider results

### F3: Tailscale FFI — No Trait Boundary (CRITICAL)
- **Problem:** `desktop/src-tauri/tailscale/` is pure CGo FFI, zero mocks
- **Fix:** `trait TailscaleProvider { fn start() -> ...; fn up() -> ... }` + `MockTailscale`
- **What to test:**
  - `MockTailscale::new().start()` returns preconfigured success/error
  - Consumer (remote/, process/) interacts via trait — tests inject mock
  - Error path: Tailscale auth failure → graceful fallback, not crash

### F4: Client-Server API Contract (HIGH)
- **Problem:** Desktop (Nuxt 4 + Tauri) calls Server (Nuxt 3 + Nitro) with no shared schema
- **Fix:** Generate OpenAPI from Nitro route types → verify desktop types match
- **What to test:**
  - `/client/game/{id}` returns shape workspace expects
  - New route added on server — desktop doesn't break (it just doesn't call it)
  - Route removed — desktop's callers produce compile-time error

### F5: Plugin Init Order (MEDIUM)
- **Problem:** 9 Nitro plugins (01- through 09-) with strict ordering
- **Fix:** Integration test verifying each plugin's postcondition after init
- **What to test:**
  - `metadataHandler.providers.values()` is non-empty after plugin 03
  - `authManager.getEnabledAuthProviders()` returns expected set after plugin 04
  - Wrong prefix position → plugin init failure detected

### F6: Tauri 7-Crate Boundaries (MEDIUM)
- **Problem:** `games` → `database`, `download_manager` → `games` — traits extracted?
- **Fix:** Per-crate trait boundary extraction + pipeline integration test
- **What to test:**
  - libarchive writes archive → droplet reads + generates manifest → database stores
  - In-memory FS fixture (tempdir) — no real Tailscale needed

---

## 4. Merge-Validation CI Gates

```
PR MERGED → MERGE-VALIDATION WORKFLOW
  │
  ├─ Stage 1: COMPILE + FORMAT (exists)
  │   └─ pnpm build + cargo check + fmt checks
  │
  ├─ Stage 2: CONTRACT GATE (NEW)
  │   ├─ Generate OpenAPI from Nitro routes
  │   ├─ Verify desktop client types match server API types
  │   ├─ Prisma schema diff (optional: pg_dump --schema-only)
  │   ├─ Tailscale trait compile-check
  │   └─ FAIL → BLOCK MERGE
  │
  ├─ Stage 3: INTEGRATION TESTS (NEW)
  │   ├─ Server: vitest --integration (API + Prisma contract tests)
  │   ├─ Metadata chain: vitest --testPathPattern=metadata-chain
  │   ├─ Rust: cargo test --all (with MockTailscale)
  │   ├─ Pipeline: libarchive→droplet→database tempdir test
  │   └─ FAIL → BLOCK MERGE
  │
  ├─ Stage 4: UNIT + COMPONENT (existing + expand)
  │   └─ vitest + cargo test
  │
  └─ Stage 5: E2E SMOKE (existing)
      └─ Playwright smoke spec
```

**New CI time estimate: ~17 min (Stages 2+3). Existing ~8 min.**

---

## 5. Creative Force-Multiplier Strategies

### M1: Property-Based Testing Blitz
- `fast-check` already in deps (v4.9.0)
- **Target:** PriorityListIndexed sorting, auth token round-trips, URL validation, provider chain invariants
- **One test covers 100+ edge cases:** `fc.property(fc.array(fc.record({priority: fc.integer()})), arr => afterSort(arr)[0].priority >= afterSort(arr)[1].priority)`

### M2: Mutation Testing (Stryker)
- Validate test QUALITY, not just line coverage
- Block PRs if mutation score drops below baseline
- **First target:** `server/server/internal/metadata/` — most logic-dense, least tested

### M3: Fork-Diff as Test Oracle
- `git diff upstream/main...HEAD` → LLM prompt → test generation
- The diff IS the spec. Every changed line is a behavioral claim.
- **Pipeline:** `.github/scripts/diff-to-test-prompt.sh` + manual vitest generation

### M4: Cross-Build CI Daisy-Chain
- Build BillyOutlast/drop artifacts, then run Drop-OSS/drop's test suite against them
- **Strongest regression signal:** If OSS tests pass with your builds, merge is safe
- **Step:** `git clone Drop-OSS/drop` → copy `server/.output/` → run OSS CI commands

### M5: Agent Hook for Auto-Test Generation
- `.opencode/hooks/` or GitHub Action that triggers on PR modifying `server/server/internal/*.ts`
- Prompt: "Generate vitest tests covering edge cases for the changed module"
- **Integration:** CI validates that new/modified code has corresponding test file

---

## 6. Implementation Phasing

### Phase 1 — Foundation (Week 1-2)
- [x] `git remote add upstream git@github.com:Drop-OSS/drop.git`
- [x] Install `cargo-llvm-cov` + add to CI (droplet-ci, cli-ci, desktop-ci)
- [x] Extract `trait TailscaleProvider` + `MockTailscale` — unblocks all Tauri Rust testing
- [ ] Add `withTestTransaction` — blocked until Prisma models defined; flag as dependency
- [x] Add property-based test for PriorityListIndexed (fast-check, 1 file, immediate win)

### Phase 2 — Security Tests (Week 2-4)
- [x] WebAuthn attestation test + gap document
- [x] OIDC group escalation test (mock provider)
- [x] Session fixation test (+ bug fix)
- [x] ACL confused deputy test
- [x] TOTP code generation/verification test
- [x] CA blacklist footgun test (+ bug fix)

### Phase 3 — Integration Seams (Week 4-8)
- [x] PrismaRepository trait extraction — BLOCKED: schema.prisma is 24-line stub with 0 models. Generated client has 29 models inlined. Must restore schema.prisma first.
- [x] Metadata provider chain fallthrough tests (5 tests, parallel Promise.allSettled pattern)
- [x] Plugin init-ordering test (10 tests, structural + behavioral)
- [x] Cross-crate pipeline test (libarchive→droplet, 2 integration tests in droplet/tests/)
- [x] Fork-diff oracle script: `.github/scripts/diff-to-test-prompt.sh`

### Phase 4 — CI Gates + Coverage (Week 8-12) — DEFERRED (multi-week effort)
- [ ] Contract gate (Stage 2): OpenAPI generation + desktop type verification
- [ ] Integration gate (Stage 3): metadata chain + Rust integration + pipeline
- [ ] Mutation testing baseline + CI gate
- [ ] Cross-build daisy-chain workflow
- [ ] Agent hook for auto-test generation on PRs

### Phase 5 — Expansion (Week 12+) — DEFERRED (multi-week effort)
- [ ] Next.js test setup (`sites/promo/`)
- [ ] Nuxt 4 test setup (`desktop/main/`)
- [ ] E2E page-flow tests (when test DB + auth fixtures available)
- [ ] Non-blocking E2E gate (Stage 5)

---

## 7. Success Criteria

**Merge-blocking gates:**
- [ ] Contract Gate: all OpenAPI types match between server and desktop
- [ ] Integration Gate: metadata chain, Rust pipeline, Prisma contract tests all pass
- [ ] Security Gate: P0 threat scenarios proven mitigated

**Coverage targets (realistic):**
- Server pure logic: **80%** (23 modules, ~200 functions)
- Server DB-dependent: **30%** (blocked on Prisma schema, then climbable)
- CLI: **60%** (lib.rs extraction + fixture-based tests)
- Desktop Rust: **20%** (database crate + trait-mocked crates)
- **Overall: 25-30%** — 10x from 1.17%

**Long-term guardrails:**
- Coverage never drops below baseline (enforced in CI once >10%)
- Mutation score never drops (Stryker gate)
- New code requires test file (agent hook or lint rule)

---

## 8. Acronyms & Key Files

| Term | Meaning |
|---|---|
| P0/P1/P2 | Priority ranking in threat model |
| F1-F8 | Integration seam fault line ID |
| MSW | Mock Service Worker (HTTP mocking) |
| M1-M5 | Creative force-multiplier strategy |
| `withTestTransaction` | `server/test/utils/db.ts` — Prisma rollback helper |

**Key files to reference:**
- `server/vitest.config.ts` — vitest config (Nuxt env, V8 coverage)
- `server/test/setup.ts` — global test setup (Nuxt stubs + MSW)
- `server/test/utils/db.ts` — Prisma transaction-per-test helper
- `server/test/mocks/` — MSW mocks (metadata, OIDC, JWT)
- `server/server/internal/` — 71 modules (23 pure logic, rest DB-dependent)
- `desktop/src-tauri/tailscale/src/lib.rs` — FFI boundary
- `.codecov.yml` — coverage gating config
- `security/risk-register.yaml` — 13 accepted risks
