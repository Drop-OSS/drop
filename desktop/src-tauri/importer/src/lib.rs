//! Local-import engine: turns a folder the player already owns into a
//! depot release.
//!
//! The pieces line up with the server contract (`utils/import/session.ts`):
//! `scan` reproduces the store's fixed 4 MiB SHA-256 chunking client-side,
//! `engine` opens a session, ships only the objects the depot lacks, and
//! commits a provenance-pinned release. Scanning is rayon-parallel; uploads
//! run a bounded `buffer_unordered` so a hundred-gigabyte import streams
//! steadily instead of materialising in RAM.

pub mod engine;
pub mod recipes;
pub mod scan;

pub use engine::{ImportOutcome, ImportProgress, ImportRequest, cancel_session, run_import};
pub use recipes::DetectedInstall;
pub use scan::{ImportError, ScanProgress, ScanResult, ScannedFile, scan_folder};

/// Convenience for callers that only want the detected installs, serialized.
pub use recipes::detect_installs;
/// The heuristic every recipe uses to tell a game folder from a leftover,
/// and the entry point it guesses for one.
pub use recipes::find_game_executable;
