# Security Policy

## Reporting a Vulnerability

Please **DO NOT** file a public GitHub issue for security vulnerabilities. Doing so may lead to the vulnerability being exploited before a fix is available.

Email: **[security@droposs.org](mailto:security@droposs.org)**

You should receive an acknowledgement within **48 hours**. If you do not, follow up via the same channel.

## Response Timeline

| Stage | Target |
|---|---|
| Acknowledgement | 48 hours |
| Triage assessment | 5 business days |
| Fix (critical/high) | 90 days |
| Fix (moderate/low) | next release cycle |
| Public disclosure | 30 days after fix release, or sooner if a public PoC emerges |

We coordinate disclosure timing with the reporter. If a vulnerability is being actively exploited in the wild, we will expedite the fix and may disclose earlier.

## Scope

**In scope:**

- Server (Nuxt 3 API, auth, data handling)
- Client SDKs (`libraries/droplet`, `libraries/droplet_types`, `libraries/native_model`)
- Web infrastructure (`sites/promo`, `sites/docs`)
- CLI tool (`cli/`) for desktop integration

**Out of scope:**

- Tauri desktop binary build pipeline (sandboxed, build-time only)
- Pre-built CLI binaries
- Experimental workspaces (`torrential/`)

## Triage Cadence

Dependabot runs weekly. Vulnerabilities are reviewed within 24 hours of the alert. New advisories are filed as GitHub Issues with the `security` label.

## Accepted Risks

Vulnerabilities that cannot be fixed (transitive deps with no upstream fix, dev-only deps, low-impact CVEs) are documented in [`security/risk-register.yaml`](./security/risk-register.yaml) with rationale and a `review_by` date. The CI check [`ci: verify risk register covers all ignored advisories`](./.github/workflows/ci.yml) enforces that every `pnpm audit --ignore` entry has a corresponding risk register entry.

## Supported Versions

| Version | Supported |
|---|---|
| `develop` branch (latest) | ✅ Security patches |
| Latest release tag | ✅ Security patches |
| Older | ❌ No backports |

We do not backport security fixes to older versions. Upgrade to `develop` or the latest release.

## Recognition

We credit security researchers who report valid vulnerabilities (with their permission) in release notes. Anonymous reports are accepted but cannot be credited.

## See also

- [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow
- [AGENTS.md](./AGENTS.md) for the dense technical reference
- [`.github/dependabot.yml`](./.github/dependabot.yml) for automated dep updates
- [`security/risk-register.yaml`](./security/risk-register.yaml) for accepted security risks
