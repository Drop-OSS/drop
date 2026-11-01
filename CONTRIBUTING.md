# Contributing to GameDepot

GameDepot is an independent hard fork of [Drop OSS](https://github.com/Drop-OSS/drop)
(AGPL-3.0). We develop it here, on our own schedule, including with AI-assisted
tooling. Upstream does not accept that kind of contribution and we do not want this
fork's work, issues, or pull requests leaking into their project.

Read [`AGENT.md`](AGENT.md) for engineering rules, branch naming, and the web-UI
preservation policy, and [`ARCHITECTURE.md`](ARCHITECTURE.md) for the internals.

## Fork boundary

**Everything stays inside `cmspeedau/GameDepot`.** Specifically:

- **Pull requests must target this repository**, base branch `develop`. Never open a
  PR against `Drop-OSS/drop`, and never use `gh pr create -R Drop-OSS/drop`.
- **No remote may point at upstream.** `origin` is the only remote we ship with. If
  you need upstream code for reference, fetch it read-only and disable its push URL:

  ```bash
  git remote add upstream https://github.com/Drop-OSS/drop.git
  git remote set-url --push upstream DISABLED
  ```

  (`scripts/check-fork-target.sh` fails on a configured upstream remote, so prefer a
  throwaway clone under `/tmp` for reference browsing.)
- **Releases and packages publish to this fork's namespaces only** — never to
  upstream's container registry (`ghcr.io/drop-oss/*`) or AUR packages
  (`drop-oss-app`, `drop-oss-app-bin`).
- **Don't link issues or PRs across the fork boundary.** Reference this repo's issues
  by number only; don't ping upstream maintainers or mention upstream PRs.

## One-time setup per clone

`gh` decides where `gh pr create` lands from a *per-clone* setting. In a fork, if that
setting is absent it can default to the **parent** repository — which is exactly how a
PR leaks upstream. Run both of these after cloning:

```bash
gh repo set-default cmspeedau/GameDepot   # PRs and issues land here
git config core.hooksPath .githooks       # refuse pushes to upstream
```

Then verify:

```bash
scripts/check-fork-target.sh
```

It checks remotes, the `gh` default repository, upstream publish targets in
`.github/workflows/`, and that the pre-push hook is active. CI runs the same script
(`.github/workflows/fork-guard.yml`), so drift fails the build instead of surprising
anyone.

## Opening a pull request

1. Branch from `develop` using the naming in `AGENT.md`
   (`feature/<slug>`, `fix/<slug>`, `chore/<slug>`).
2. Push to `origin` (this fork), never upstream.
3. `gh pr create --base develop` — confirm the output says
   `cmspeedau/GameDepot`, not `Drop-OSS/drop`.
4. One logical change per PR; explain *why* in the description. Don't commit secrets,
   tokens, signed URLs, or user data.

## Fork-specific Actions configuration

Repository **variables** (Settings → Secrets and variables → Actions → Variables), all
optional:

| Variable | Effect |
| --- | --- |
| `PUBLISH_AUR` | `true` publishes the AUR packages. Off by default — see the debt list below. |
| `MACOS_SIGNING_IDENTITY` | Codesign identity for macOS builds. Unset ⇒ macOS builds are unsigned and the signing steps are skipped. |
| `MACOS_DEVELOPER_CERT_URL` | URL of the `.der` certificate to trust before signing. Used only when `MACOS_SIGNING_IDENTITY` is set. |

Container images publish to `ghcr.io/cmspeedau/gamedepot` (set once in
`server-release.yml`), never upstream's registry.

## Remaining upstream-branded debt

Upstream references are gone from the paths that could leak: the update check, the
PCGamingWiki user agent, the deploy template's image, the release-packaging URLs, and
macOS code-signing no longer point at upstream. **Flatpak packaging was removed** —
this fork does not ship a Flatpak.

What is still upstream-branded, deliberately:

- **Package names.** The AUR packages are still `drop-oss-app` / `drop-oss-app-bin`, and
  they conflict with each other by that name. Publishing them is gated behind the
  repository variable `PUBLISH_AUR` (default off) because the names live in *upstream's*
  AUR namespace; renaming them to fork-owned names (and creating those AUR repos) is a
  separate change.
- **Desktop binary names.** `tauri.conf.json` bundles are named after `productName`
  (`GameDepot`), but the Arch recipe still installs `drop-app` and a
  `drop-oss-app.desktop` entry, and the deep-link plugin still accepts the `drop`
  scheme alongside `gamedepot` (kept for existing links). Verify against a real build
  before renaming: the desktop crate does not currently build in CI-free environments.
- **`sites/docs/`.** The docs site is still upstream's Astro site: "Drop OSS" title,
  `https://github.com/Drop-OSS/` links, and `site: "https://droposs.org"`.
- **`libraries/native_model`.** A vendored third-party crate whose `repository` field
  correctly points at its own upstream project (`Drop-OSS/native_model`). Leave it —
  that is attribution, not branding.

Changing any of these is welcome as its own change; keep the fork-boundary guard green.
