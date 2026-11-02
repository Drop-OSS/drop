//! Cloud-save engine: the desktop half of versioned cloud saves.
//!
//! The contract this crate implements (and must never silently drift from) is
//! the one verified by `server/e2e/saves*.e2e.ts`:
//!
//! - a save is a deterministic `tar.zstd` archive of the files a Ludusavi
//!   manifest entry resolves to on this machine;
//! - its portable identity is the *content hash*: sha256 over canonical JSON
//!   of `[{key,size,sha256,mode}]` sorted by key, where `key` is the template
//!   tail after the last placeholder - so the same logical save hashes
//!   identically on Linux, Windows and inside a Proton prefix;
//! - uploads carry `If-Match: <baseVersionId>` and the server answers `409`
//!   (with the real head) if this device's baseline went stale;
//! - v1 policy: back up on game exit, pull before launch only when the local
//!   save is clean, and *never* auto-resolve a conflict - the caller (UI)
//!   decides.
//!
//! Layout: `manifest` parses server save manifests, `context` resolves
//! placeholders (including Proton prefixes) to concrete files and portable
//! keys, `archive` builds/extracts the deterministic archive, `client` speaks
//! the HTTP contract, `engine` orchestrates the two device-side flows, and
//! `canonical` reproduces the server's canonical-JSON hashing byte for byte
//! (see its cross-language test vectors).

pub mod archive;
pub mod canonical;
pub mod client;
pub mod context;
pub mod engine;
pub mod error;
pub mod manifest;
pub mod normalise;
pub mod path;
pub mod placeholder;
