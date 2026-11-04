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

use std::path::{Path, PathBuf};

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
    /// The executable that starts the game, relative to `folder`, picked by
    /// [`find_game_executable`]. Enough to launch the copy in place; the
    /// player overrides it in the UI when a title disagrees with the guess.
    pub executable: Option<String>,
    /// The prefix root whose drive contains [`folder`], when the install
    /// lives inside one. A game installed by a storefront into a prefix has
    /// to run in that prefix - its registry entries, its service links, its
    /// save paths were all written there.
    pub prefix: Option<PathBuf>,
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

/// The executable that starts the game inside `root`, as a path relative to
/// it, or None when nothing in the folder could be the game itself.
///
/// The rule is shallowest wins: a title's entry point sits at the top of its
/// folder far more often than not, and everything deeper is more likely a
/// bundled tool. Installer-shaped names are skipped wherever they are,
/// because launchers leave their prerequisites next to the game long after
/// installing, and a folder whose only executables are prerequisites is an
/// uninstall leftover, not a game.
pub fn find_game_executable(root: &Path) -> Option<String> {
    if !root.is_dir() {
        return None;
    }
    let mut best: Option<(usize, String)> = None;
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
        // A game folder can hold a hundred thousand files; the executable is
        // nearly always near the top, so stop looking long before that.
        if examined > 4_000 {
            break;
        }
        let path = entry.path();
        if !matches!(
            path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()),
            Some(ext) if ext == "exe"
        ) {
            continue;
        }
        let name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();
        if is_support_executable(&name) {
            continue;
        }
        let depth = entry.depth();
        let relative = path
            .strip_prefix(root)
            .ok()
            .map(|rel| rel.to_string_lossy().replace('\\', "/"))?;
        if best.as_ref().is_none_or(|(d, _)| depth < *d) {
            best = Some((depth, relative));
            // Depth 1 is as good as this heuristic gets; stop early.
            if depth == 1 {
                break;
            }
        }
    }
    best.map(|(_, rel)| rel)
}

/// Names that mean "this installs something" rather than "this is the game".
/// Deliberately short: real entry points with a scary name (a launcher the
/// game itself starts from, like Rockstar's LaunchPad) must survive.
fn is_support_executable(lower_stem: &str) -> bool {
    const SKIP: &[&str] = &[
        "vcredist",
        "dxsetup",
        "dxwebsetup",
        "directx",
        "dotnetfx",
        "dotnet",
        "netfx",
        "d3dxinstalls",
        "xact",
        "unins",
        "eula",
        "setup",
        "install",
        "updateinstaller",
        "prerequisite",
        "oeminstall",
    ];
    SKIP.iter()
        .any(|skip| lower_stem.starts_with(skip) || lower_stem.ends_with(skip))
}
