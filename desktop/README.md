# Desktop

The official desktop client for Drop.

## Release packages

Only regular GitHub releases (not marked as pre-release) update the AUR packages.
Pre-releases skip AUR publishing. Both release types build and upload an x86_64
Arch Linux `.pkg.tar.zst` package to the GitHub release. Manually dispatched runs
use the target GitHub release's pre-release flag.

Both release types also upload x86_64 and ARM64 (`aarch64`) Flatpak bundles. Each
bundle is built on a native runner using the matching Debian release asset and
its SHA-256 checksum.