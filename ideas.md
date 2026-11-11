# GameDepot Ideas

A parking lot for useful product and engineering ideas, including selected
inspiration from [Drop OSS issues](https://github.com/Drop-OSS/drop/issues).
These are ideas to evaluate, not commitments or claims that the feature is
missing. Check the current implementation and roadmap before starting work.

## Reliability and launch experience

### Audit AppImage child-process environment — Drop #505

[Drop issue #505](https://github.com/Drop-OSS/drop/issues/505) reports that an
AppImage can pass incompatible `PYTHONHOME`, `PYTHONPATH`, or library-path
settings to `umu-run`, preventing Proton games from starting.

- Reproduce or rule out the issue with GameDepot's AppImage and supported UMU
  launch paths.
- If present, sanitize only the AppImage-specific variables that break child
  tools; preserve variables deliberately required by the game or runtime.
- Add a regression test or diagnostic that verifies the child environment.

### Verify emulator/dependency installation on Linux — Drop #534

[Drop issue #534](https://github.com/Drop-OSS/drop/issues/534) reports that an
emulator dependency does not install on Linux even though the dependent game
installs.

- Check GameDepot's dependency install and launch paths on Linux, including
  missing, partially installed, and setup-required dependencies.
- Report actionable dependency state instead of panicking or failing with a
  generic launch error.
- Add an end-to-end test for a game that launches through an installed
  emulator.

### Make working-directory behavior explicit — Drop #435

[Drop issue #435](https://github.com/Drop-OSS/drop/issues/435) describes a
Linux game that only launches after its executable is made absolute.

- Test relative executables, scripts, paths with spaces, and games that expect
  their own install directory as the current working directory.
- Decide and document whether the working directory defaults to the game's
  install directory, the emulator's directory, or can be overridden per
  launch configuration.
- Preserve argument boundaries and avoid shell-string workarounds when
  resolving paths.

### Improve launch-command configuration — Drop #532

[Drop issue #532](https://github.com/Drop-OSS/drop/issues/532) asks for
per-game environment overrides and more control over Proton/Wine launch
commands.

- Make environment variables and runner options easy to configure in the
  admin UI and, where appropriate, per-game client overrides.
- Keep variables structured and scoped to the child process; do not require
  shell prefixes for common settings.
- Preserve a safe argument-array launch path and clearly distinguish trusted
  admin configuration from untrusted catalog metadata.

### Support multiple install steps — Drop #352

[Drop issue #352](https://github.com/Drop-OSS/drop/issues/352) requests
multiple ordered installers, such as a base game installer followed by DLC or
bonus content installers.

- Model install steps as ordered configuration rather than a generated shell
  script.
- Show progress and the failing step; make retries and cancellation behavior
  explicit.
- Consider whether the same mechanism should cover prerequisites, patches,
  and optional content without conflating those lifecycles.

### Native launch support for HTML games — Drop #476

[Drop issue #476](https://github.com/Drop-OSS/drop/issues/476) requests
support for games distributed as HTML files.

- Evaluate launching a local HTML entry point in a user-selected browser or
  an explicitly supported embedded runtime.
- Keep browser selection and arguments platform-aware; do not silently open
  arbitrary remote URLs.
- Decide whether this belongs in the launch-method model or a distinct game
  target type.

## Dependencies and compatibility tools

### Shared redistributable/dependency support — Drop #190

[Drop issue #190](https://github.com/Drop-OSS/drop/issues/190) proposes
server-configured redistributables that games can require. GameDepot could
support two supply modes:

1. **Runtime download:** fetch a pinned artifact from an admin-configured,
   trusted source when a client needs it. Show the source, version, size, and
   license; verify a configured digest/signature; ask before first download
   where appropriate; cache the verified artifact for reuse.
2. **Admin-supplied artifact:** provide an admin upload/import area where the
   server owner supplies the files and records version and license/source
   details. Clients then receive the configured artifact through the normal
   authenticated distribution path.

Shared requirements:

- Reuse verified artifacts across games instead of duplicating downloads.
- Declare platform, architecture, version, and install/configuration steps.
- Make dependencies optional or required explicitly and show what uses them.
- Keep dependency execution separate from store acquisition; do not run
  untrusted package scripts implicitly.
- Respect redistribution rights. Admin-supplied files do not automatically
  grant permission to redistribute them to clients.

### Proton/UMU tool repository — Drop #315

[Drop issue #315](https://github.com/Drop-OSS/drop/issues/315) proposes
admin-managed Proton builds that clients can select or acquire.

- Consider this as a specialized case of shared compatibility tools rather
  than a separate download system.
- Prefer discovering user-installed Proton builds first; allow an admin to
  offer pinned builds only with clear licensing, provenance, verification,
  storage, and update policies.
- Keep the runner optional and independent of game acquisition.

## Storage and connectivity

### S3-compatible object storage — Drop #407

[Drop issue #407](https://github.com/Drop-OSS/drop/issues/407) asks for direct
S3 storage support.

- Evaluate an S3-compatible backend for object storage and large downloads.
- Preserve content-addressed identity, digest verification, atomic
  publication, and garbage-collection/reference semantics.
- Decide whether clients download directly using short-lived authorized URLs
  or continue through the GameDepot server; account for private buckets,
  range requests, and egress costs.

### Offline and LAN cache modes — Drop #218

[Drop issue #218](https://github.com/Drop-OSS/drop/issues/218) proposes full
offline operation. GameDepot's roadmap already has a **Cache Node** idea for
read-through LAN/offline depot delivery, so coordinate rather than duplicate
that work.

- Distinguish server-unreachable play from fully offline administration,
  metadata search, authentication, and acquisition; define which guarantees
  each mode provides.
- Cache verified manifests and objects, with explicit freshness and storage
  policies.
- Keep offline behavior honest about operations that require the server.

## Self-hosting and library management

### Nix packaging and modules — Drop #440

[Drop issue #440](https://github.com/Drop-OSS/drop/issues/440) requests Nix
support. This repository already contains Nix flakes for `cli` and
`libraries/droplet`; check their current coverage before expanding packaging.

- Evaluate a desktop package and a NixOS server module for reproducible
  installation and upgrades.
- Document supported systems, service configuration, persistent data paths,
  and upgrade/rollback behavior.
- Avoid duplicating packaging work already provided by the existing flakes.

## Existing GameDepot work to account for

Drop's [cloud-save issue #65](https://github.com/Drop-OSS/drop/issues/65) is
still listed as open upstream, but GameDepot already has a substantial
cloud-save implementation. See the cloud-save section in `ROADMAP.md`; this
is not a gap to copy without first checking the current implementation and
its remaining validation work.
