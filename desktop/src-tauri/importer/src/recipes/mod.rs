//! Launcher recipes: how each storefront records what it installed.
//!
//! The import engine itself is provider-neutral - a folder is a folder. What
//! differs per launcher is where it hides its install records, so each recipe
//! answers one question: *which folders on this machine hold games this
//! launcher installed, and what does the launcher call them?* Answers feed the
//! same import form a player fills in by hand; a wrong or missing guess costs
//! a typed title, never a broken release.
//!
//! Recipes detect from files a launcher wrote, never from its live services:
//! the depot needs the bytes that exist on disk, and it must keep working when
//! the storefront's servers are down or an account is signed out.

pub mod ea;

use std::path::PathBuf;

use serde::Serialize;

/// One install a launcher put on this machine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedInstall {
    /// Which recipe found it (`"ea"` today; `"rockstar"`, `"steam"` later).
    pub launcher: &'static str,
    /// The name to prefill the import form with. The player can correct it.
    pub title: String,
    /// The game folder, already resolved and verified to exist.
    pub folder: PathBuf,
    /// The launcher's own identifier for the install when it keeps one
    /// (EA's content id, a registry key name). Used to match a detected
    /// install against a catalog game.
    pub install_key: Option<String>,
}

/// Every install the known recipes can find on this machine.
///
/// `prefix_roots` are WINEPREFIX-style directories (one `pfx` directory per
/// game, or a shared storefront prefix); each is searched as its own Windows
/// filesystem. On Windows the machine's real drives are searched as well.
pub fn detect_installs(prefix_roots: &[PathBuf]) -> Vec<DetectedInstall> {
    let mut found = Vec::new();
    for root in prefix_roots {
        found.extend(ea::detect(&ea::WindowsFs::Prefix(root.clone())));
    }
    #[cfg(windows)]
    {
        found.extend(ea::detect(&ea::WindowsFs::Native));
    }
    // Two roots can name the same folder (an override dir that is also the
    // conventional one), and a list with the same game twice is a bug a
    // player has to notice.
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    found.retain(|install| seen.insert(install.folder.clone()));
    found.sort_by(|a, b| {
        (a.title.to_lowercase(), &a.folder).cmp(&(b.title.to_lowercase(), &b.folder))
    });
    found
}

/// True when a folder looks like a game install rather than a leftover: it
/// contains an executable within a few levels. Recipes use this to drop the
/// config and save folders a launcher leaves behind after an uninstall, which
/// are otherwise indistinguishable from a game directory by name alone.
pub(crate) fn looks_like_install(root: &std::path::Path) -> bool {
    if !root.is_dir() {
        return false;
    }
    let mut examined = 0usize;
    for entry in walkdir::WalkDir::new(root)
        .follow_links(false)
        .max_depth(3)
        .into_iter()
        .filter_entry(|e| {
            // Save, log and redistributable folders live inside old installs
            // too; a `__redist` full of installers is not a game.
            !matches!(
                e.file_name()
                    .to_string_lossy()
                    .to_ascii_lowercase()
                    .as_str(),
                "saves"
                    | "save"
                    | "savedgames"
                    | "userdata"
                    | "crashes"
                    | "logs"
                    | "redist"
                    | "__redist"
            )
        })
    {
        let Ok(entry) = entry else {
            continue;
        };
        if !entry.file_type().is_file() {
            continue;
        }
        examined += 1;
        if matches!(
            entry.path().extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()),
            Some(ext) if ext == "exe"
        ) {
            return true;
        }
        // A game folder can hold a hundred thousand files; the executable is
        // nearly always near the top, so stop looking long before that.
        if examined > 4_000 {
            return false;
        }
    }
    false
}
