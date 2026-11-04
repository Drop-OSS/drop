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
pub mod epic;
pub mod gog;
pub mod rockstar;
pub mod steam;
pub mod ubi;

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// One install a launcher put on this machine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedInstall {
    /// Which recipe found it (`"ea"`, `"epic"`, `"gog"`, `"rockstar"`,
    /// `"steam"`, `"ubi"`).
    pub launcher: &'static str,
    /// The name to prefill the import form with. The player can correct it.
    pub title: String,
    /// The game folder, already resolved and verified to exist.
    pub folder: PathBuf,
    /// The launcher's own identifier for the install when it keeps one
    /// (Epic's app name today; EA's content id later). Used to match a
    /// detected install against a catalog game.
    pub install_key: Option<String>,
    /// The executable that starts the game, relative to `folder`, picked by
    /// [`find_game_executable`] unless the launcher records a better answer.
    /// Enough to launch the copy in place; the player overrides it in the UI
    /// when a title disagrees with the guess.
    pub executable: Option<String>,
    /// The prefix root whose drive contains [`folder`], when the install
    /// lives inside one. A game installed by a storefront into a prefix has
    /// to run in that prefix - its registry entries, its service links, its
    /// save paths were all written there.
    pub prefix: Option<PathBuf>,
}

/// The Windows filesystem a launcher wrote into: either a prefix's drives,
/// with `C:\` and `Z:\` resolving through Wine's own links, or this machine's
/// real drives on Windows.
#[derive(Clone)]
pub enum WindowsFs {
    /// A WINEPREFIX-style directory containing `drive_c` and `dosdevices`.
    Prefix(PathBuf),
    /// Native: values are used as they stand.
    Native,
}

impl WindowsFs {
    /// Where a drive letter lands. A drive the prefix has no link for is not
    /// available, which the caller reads as "no installs there".
    fn drive_root(&self, drive: char) -> Option<PathBuf> {
        match self {
            WindowsFs::Native => None,
            WindowsFs::Prefix(root) => {
                // `drive_c` is the real directory; Wine's `c:` link points at
                // it. Prefer the plain spelling so reported paths read as the
                // folder a player would recognize.
                if drive.eq_ignore_ascii_case(&'c') {
                    let direct = root.join("drive_c");
                    if direct.is_dir() {
                        return Some(direct);
                    }
                }
                // Wine represents each other drive as a symlink named `d:`,
                // `z:` under `dosdevices`; `z:` is the host filesystem itself,
                // so a launcher that installed onto a second disk needs this.
                let link = root
                    .join("dosdevices")
                    .join(format!("{}:", drive.to_ascii_lowercase()));
                if link.is_dir() {
                    return Some(link);
                }
                None
            }
        }
    }

    /// The C: drive, where `ProgramData` and each account's AppData live.
    pub fn system_drive(&self) -> PathBuf {
        match self {
            WindowsFs::Native => {
                PathBuf::from(std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into()))
            }
            WindowsFs::Prefix(root) => self.drive_root('c').unwrap_or_else(|| root.join("drive_c")),
        }
    }

    /// The prefix this filesystem is, when it is one: travels with every
    /// install found here, because playing the copy means running it in the
    /// same prefix the launcher wrote it into.
    pub fn prefix(&self) -> Option<PathBuf> {
        match self {
            WindowsFs::Prefix(root) => Some(root.clone()),
            WindowsFs::Native => None,
        }
    }

    /// Every account's AppData directory on this drive's `users` tree.
    /// Launchers store their per-account settings under one of these.
    pub fn user_appdata_local(&self) -> Vec<PathBuf> {
        self.user_appdata("Local")
    }

    pub fn user_appdata_roaming(&self) -> Vec<PathBuf> {
        self.user_appdata("Roaming")
    }

    fn user_appdata(&self, which: &str) -> Vec<PathBuf> {
        let users = self.system_drive().join("users");
        let Ok(entries) = std::fs::read_dir(&users) else {
            return Vec::new();
        };
        entries
            .flatten()
            .map(|entry| entry.path().join("AppData").join(which))
            .filter(|path| path.is_dir())
            .collect()
    }
}

/// Interpret a Windows path written by a launcher. Values look like
/// `C:\Program Files\EA Games\`, from INI files, YAML, JSON or VDF.
///
/// Inside a prefix each drive letter goes through the prefix's own mapping, so
/// `Z:\Games` reaches a second disk the way Wine would. A value that climbs out
/// of its drive with `..` is refused rather than clamped: these files are the
/// launcher's own, and one that points sideways is not a setting worth
/// honouring.
pub fn resolve_windows_path(value: &str, fs: &WindowsFs) -> Option<PathBuf> {
    if matches!(fs, WindowsFs::Native) {
        // The drives are real here; the value is already the path.
        return Some(PathBuf::from(value));
    }
    // Take the drive only when the value really carries one: a bare
    // `Games\EA` must keep its first segment, so the test is a
    // letter-plus-colon prefix, not "any colon or backslash".
    let (drive, rest) = match value.split_once(':') {
        Some((drive, rest))
            if drive.chars().count() == 1
                && drive
                    .chars()
                    .next()
                    .is_some_and(|c| c.is_ascii_alphabetic()) =>
        {
            (drive.chars().next().map(|c| c.to_ascii_lowercase()), rest)
        }
        _ => (None, value),
    };
    let relative = rest.replace('\\', "/");
    if relative.split('/').any(|part| part == "..") {
        return None;
    }
    let base = match drive {
        Some(letter) => fs.drive_root(letter)?,
        // A value with no drive belongs to the system drive, as Windows reads it.
        None => fs.system_drive(),
    };
    Some(
        relative
            .split('/')
            .filter(|part| !part.is_empty() && *part != ".")
            .fold(base, |mut acc, part| {
                acc.push(part);
                acc
            }),
    )
}

/// Every install the known recipes can find on this machine.
///
/// `prefix_roots` are WINEPREFIX-style directories (one `pfx` directory per
/// game, or a shared storefront prefix); each is searched as its own Windows
/// filesystem. On Windows the machine's real drives are searched as well.
pub fn detect_installs(prefix_roots: &[PathBuf]) -> Vec<DetectedInstall> {
    let mut found = Vec::new();
    let mut seen: BTreeSet<PathBuf> = BTreeSet::new();

    // Only mutated on Windows, where the native drives join the search.
    #[cfg_attr(not(windows), allow(unused_mut))]
    let mut worlds: Vec<WindowsFs> = prefix_roots
        .iter()
        .map(|root| WindowsFs::Prefix(root.clone()))
        .collect();
    #[cfg(windows)]
    worlds.push(WindowsFs::Native);

    for fs in &worlds {
        for recipe in [
            ea::detect as fn(&WindowsFs, &mut BTreeSet<PathBuf>, &mut Vec<DetectedInstall>),
            epic::detect,
            gog::detect,
            rockstar::detect,
            steam::detect,
            ubi::detect,
        ] {
            recipe(fs, &mut seen, &mut found);
        }
    }

    found.sort_by(|a, b| {
        (a.title.to_lowercase(), &a.folder).cmp(&(b.title.to_lowercase(), &b.folder))
    });
    found
}

/// Immediate children of an install root that look like games. One walk's
/// answer serves both questions worth asking: a folder counts only if it
/// holds an executable that is not a redistributable, and that executable
/// travels with the result as the play target.
pub(crate) fn collect_installs(
    launcher: &'static str,
    root: &Path,
    fs: &WindowsFs,
    seen: &mut BTreeSet<PathBuf>,
    out: &mut Vec<DetectedInstall>,
) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let folder = entry.path();
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        // Launchers live next to their games and are not games: their own
        // folders would otherwise offer themselves up by the same rule.
        let title = folder
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        if title.is_empty() || is_launcher_folder(&title) {
            continue;
        }
        let Some(executable) = find_game_executable(&folder) else {
            continue;
        };
        if !seen.insert(folder.clone()) {
            continue;
        }
        out.push(DetectedInstall {
            launcher,
            title,
            folder,
            install_key: None,
            executable: Some(executable),
            prefix: fs.prefix(),
        });
    }
}

/// A folder in a games directory that belongs to the launcher, not a game.
fn is_launcher_folder(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "launcher"
            | "epicgameslauncher"
            | "epic games launcher"
            | "games launcher"
            | "social club"
            | "rockstar games launcher"
            | "galaxyclient"
            | "gog galaxy"
            | "uplay"
            | "ubisoft game launcher"
            | "steam"
            | "steamapps"
            | "redist"
            | "__redist"
            | "directxredist"
            | "gameprereq"
            | "gameprerequisites"
    )
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
                    | "_redist"
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
