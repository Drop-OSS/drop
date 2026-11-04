//! EA app: which folders the launcher installed games into.
//!
//! The EA app records its install location in plain INI files - the default
//! in-place directory in `ProgramData/EA Desktop/machine.ini`, and a per-user
//! override in `users/<name>/AppData/Local/Electronic Arts/EA Desktop/`
//! (`user.downloadinplacedir`). Those files sit inside the same Windows
//! filesystem the launcher itself sees, which makes the whole thing readable
//! from a Wine or umu prefix as easily as from a real Windows install: the
//! storefront prefix's `drive_c` *is* the C: drive the launcher wrote to.
//!
//! What is deliberately not here: the live catalog, entitlements, and the
//! registry. The registry is where EA's own install list lives, but reading it
//! needs an elevated native call on Windows and a registry hive parser here,
//! and the folder the launcher installs into answers the only question the
//! importer has. A game EA knows about but whose folder is gone is not
//! importable, so missing it costs nothing.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::{DetectedInstall, looks_like_install};

pub const LAUNCHER: &str = "ea";

/// The directory names EA has installed games into across its versions.
const CONVENTIONAL_ROOTS: [&str; 3] = [
    "Program Files/EA Games",
    "Program Files (x86)/EA Games",
    "EA Games",
];

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
    fn system_drive(&self) -> PathBuf {
        match self {
            WindowsFs::Native => {
                PathBuf::from(std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into()))
            }
            WindowsFs::Prefix(root) => self.drive_root('c').unwrap_or_else(|| root.join("drive_c")),
        }
    }
}

/// Installs the EA app put on this machine, searching one Windows filesystem:
/// a prefix's drives, or the real ones on Windows.
pub fn detect(fs: &WindowsFs) -> Vec<DetectedInstall> {
    let mut installs = Vec::new();
    let mut seen: BTreeSet<PathBuf> = BTreeSet::new();

    for install_root in install_roots(fs) {
        collect_installs(&install_root, &mut seen, &mut installs);
    }

    installs
}

/// The directories an EA install may live directly under.
fn install_roots(fs: &WindowsFs) -> Vec<PathBuf> {
    let mut roots: BTreeSet<PathBuf> = BTreeSet::new();
    let system = fs.system_drive();
    if !system.is_dir() {
        return Vec::new();
    }

    for ini in ea_ini_files(&system) {
        for value in inipaths_in(&ini) {
            let Some(mapped) = resolve_windows_path(&value, fs) else {
                continue;
            };
            // Only an existing directory counts: a settings file pointing at
            // a drive that was unplugged is not an install.
            if mapped.is_dir() {
                roots.insert(mapped);
            }
        }
    }

    for name in CONVENTIONAL_ROOTS {
        let candidate = system.join(name);
        if candidate.is_dir() {
            roots.insert(candidate);
        }
    }

    roots.into_iter().collect()
}

/// The two INI locations EA keeps install settings in, if they exist.
fn ea_ini_files(drive_c: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();

    let machine = drive_c
        .join("ProgramData")
        .join("EA Desktop")
        .join("machine.ini");
    if machine.is_file() {
        files.push(machine);
    }

    // One settings file per signed-in account, named by EA's user id.
    let users = drive_c.join("users");
    if let Ok(entries) = fs::read_dir(&users) {
        for entry in entries.flatten() {
            let dir = entry
                .path()
                .join("AppData")
                .join("Local")
                .join("Electronic Arts")
                .join("EA Desktop");
            let Ok(appdata) = fs::read_dir(&dir) else {
                continue;
            };
            for file in appdata.flatten() {
                let path = file.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.starts_with("user_") && name.ends_with(".ini") {
                    files.push(path);
                }
            }
        }
    }

    files
}

/// Every `*.downloadinplacedir` value in an EA INI file.
///
/// Keys are dotted (`machine.downloadinplacedir`, `user.downloadinplacedir`);
/// the prefix is the file's own namespace, so the suffix is what matters. A
/// directory containing a newline cannot survive this line-based reader, and
/// Windows forbids one in a name anyway.
fn inipaths_in(file: &Path) -> Vec<String> {
    let Ok(text) = fs::read_to_string(file) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| {
            let (key, value) = line.split_once('=')?;
            if !key
                .trim()
                .to_ascii_lowercase()
                .ends_with(".downloadinplacedir")
            {
                return None;
            }
            let value = value.trim().trim_matches('"').trim_end_matches(['\\', '/']);
            (!value.is_empty()).then(|| value.to_string())
        })
        .collect()
}

/// Interpret a Windows path written by a launcher. Values look like
/// `C:\Program Files\EA Games\`, and the backslashes are literal: this is an
/// INI file, not a registry export.
///
/// Inside a prefix each drive letter goes through the prefix's own mapping, so
/// `Z:\Games` reaches a second disk the way Wine would. A value that climbs out
/// of its drive with `..` is refused rather than clamped: these files are the
/// launcher's own, and one that points sideways is not a setting worth
/// honouring.
fn resolve_windows_path(value: &str, fs: &WindowsFs) -> Option<PathBuf> {
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
    if matches!(fs, WindowsFs::Native) {
        // The drives are real here; the value is already the path.
        return Some(PathBuf::from(value));
    }
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

/// Immediate children of an install root that look like games.
fn collect_installs(root: &Path, seen: &mut BTreeSet<PathBuf>, out: &mut Vec<DetectedInstall>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let folder = entry.path();
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        if !looks_like_install(&folder) {
            continue;
        }
        let title = folder
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        if title.is_empty() || !seen.insert(folder.clone()) {
            continue;
        }
        out.push(DetectedInstall {
            launcher: LAUNCHER,
            title,
            folder,
            install_key: None,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A prefix laid out like a real one: `drive_c`, the `dosdevices` links a
    /// launcher's drives resolve through, and EA's own settings files.
    fn prefixfixture(name: &str, with_games: bool) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("gd-importer-ea-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let drive_c = root.join("drive_c");
        fs::create_dir_all(drive_c.join("ProgramData/EA Desktop")).unwrap();
        fs::write(
            drive_c.join("ProgramData/EA Desktop/machine.ini"),
            "BackgroundServicePort=37951\r\nmachine.downloadinplacedir=C:\\Program Files\\EA Games\\\r\nmachine.updatebucket=1\r\n",
        )
        .unwrap();
        let user_dir = drive_c.join("users/steamuser/AppData/Local/Electronic Arts/EA Desktop");
        fs::create_dir_all(&user_dir).unwrap();
        fs::write(
            user_dir.join("user_4551315433871347209.ini"),
            "user.windowscreenheight=1050\r\nuser.downloadinplacedir=C:\\Games\\EA\\\r\n",
        )
        .unwrap();
        // Both roots exist even without games: an empty install directory is a
        // setting, not an install.
        fs::create_dir_all(drive_c.join("Program Files/EA Games")).unwrap();
        fs::create_dir_all(drive_c.join("Games/EA")).unwrap();

        let dosdevices = root.join("dosdevices");
        fs::create_dir_all(&dosdevices).unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("../drive_c", dosdevices.join("c:")).unwrap();
            // A second disk: what Wine's `z:` link points at for a player who
            // keeps games elsewhere.
            fs::create_dir_all(root.join("hostdisk")).unwrap();
            std::os::unix::fs::symlink("../hostdisk", dosdevices.join("z:")).unwrap();
        }

        if with_games {
            let game = drive_c.join("Program Files/EA Games/Need for Speed Heat");
            fs::create_dir_all(&game).unwrap();
            fs::write(game.join("NFSHeat.exe"), b"MZ").unwrap();
            // The per-user override root, with a game inside it.
            let other = drive_c.join("Games/EA/Star Wars Jedi");
            fs::create_dir_all(other.join("StarWarsJD")).unwrap();
            fs::write(other.join("StarWarsJD/jedi.exe"), b"MZ").unwrap();
            // A leftover config folder an uninstall forgot: not an install.
            let leftover = drive_c.join("Program Files/EA Games/Empty Remnant");
            fs::create_dir_all(leftover.join("SaveGame")).unwrap();
            fs::write(leftover.join("SaveGame/slot.dat"), b"x").unwrap();
            // A redistributable folder is not a game either, installers and all.
            let redist = drive_c.join("Program Files/EA Games/Redist Remnant/__redist");
            fs::create_dir_all(&redist).unwrap();
            fs::write(redist.join("vcredist.exe"), b"MZ").unwrap();
            // A second account that keeps its games on another drive: the
            // setting names a Z: path, which the prefix resolves through its
            // own link.
            fs::write(
                user_dir.join("user_9999999999.ini"),
                "user.userid=9999999999\r\nuser.downloadinplacedir=Z:\\EA Games\\\r\n",
            )
            .unwrap();
            // And a game on the other drive, declared with a Z: path.
            let second = root.join("hostdisk/EA Games/Battlefield V");
            fs::create_dir_all(&second).unwrap();
            fs::write(second.join("BFV.exe"), b"MZ").unwrap();
        }
        root
    }

    fn with_prefix_games(body: impl FnOnce(&Path, &WindowsFs)) {
        let prefix = prefixfixture("games", true);
        body(&prefix, &WindowsFs::Prefix(prefix.clone()));
        fs::remove_dir_all(&prefix).ok();
    }

    #[test]
    fn ini_values_become_prefix_paths() {
        let prefix = prefixfixture("roots", false);
        let fs = WindowsFs::Prefix(prefix.clone());
        let drive_c = fs.system_drive();
        let roots = install_roots(&fs);
        assert!(
            roots.contains(&drive_c.join("Program Files/EA Games")),
            "the machine-wide in-place dir: {roots:?}"
        );
        assert!(
            roots.contains(&drive_c.join("Games/EA")),
            "the per-user override: {roots:?}"
        );
        assert!(
            !roots
                .iter()
                .any(|r| r.to_string_lossy().contains(":\\")
                    || r.to_string_lossy().starts_with("C:")),
            "no value keeps a Windows drive letter: {roots:?}"
        );
        fs::remove_dir_all(&prefix).ok();
    }

    #[test]
    fn detected_installs_are_game_folders_not_leftovers() {
        with_prefix_games(|prefix, fs| {
            let found = detect(fs);
            let titles: Vec<&str> = found.iter().map(|i| i.title.as_str()).collect();
            assert!(
                titles.contains(&"Need for Speed Heat"),
                "the conventional root is searched: {titles:?}"
            );
            assert!(
                titles.contains(&"Star Wars Jedi"),
                "the per-user override root is searched: {titles:?}"
            );
            assert!(
                !titles.contains(&"Empty Remnant"),
                "a folder with no executable is not an install: {titles:?}"
            );
            assert!(
                !titles.contains(&"Redist Remnant"),
                "a folder whose only executables are redistributables is not one: {titles:?}"
            );
            assert!(
                titles.contains(&"Battlefield V"),
                "a drive the prefix links is searched too: {titles:?}"
            );
            assert!(
                found
                    .iter()
                    .any(|i| i.folder.starts_with(prefix.join("dosdevices").join("z:"))),
                "the other drive's install is reported under that drive's path"
            );
            assert!(found.iter().all(|i| i.launcher == LAUNCHER));
        });
    }

    #[test]
    fn a_missing_prefix_finds_nothing() {
        let found = detect(&WindowsFs::Prefix(PathBuf::from("/nonexistent/prefix")));
        assert!(found.is_empty());
    }

    #[test]
    fn paths_follow_the_prefix_drive_map_and_never_escape_it() {
        let prefix = prefixfixture("mapping", false);
        let fs = WindowsFs::Prefix(prefix.clone());
        let drive_c = prefix.join("drive_c");
        assert_eq!(
            resolve_windows_path("C:\\Program Files (x86)\\EA Games\\", &fs),
            Some(drive_c.join("Program Files (x86)/EA Games"))
        );
        assert_eq!(
            resolve_windows_path("C:/Program Files/EA Games/Star Wars", &fs),
            Some(drive_c.join("Program Files/EA Games/Star Wars"))
        );
        assert_eq!(
            resolve_windows_path("Games\\EA\\", &fs),
            Some(drive_c.join("Games/EA")),
            "a driveless value belongs to the system drive"
        );
        #[cfg(unix)]
        assert_eq!(
            resolve_windows_path("Z:\\EA Games\\Battlefield V", &fs),
            Some(prefix.join("dosdevices/z:/EA Games/Battlefield V")),
            "a value naming another drive follows the prefix's own link"
        );
        assert_eq!(
            resolve_windows_path("Q:\\Games\\EA", &fs),
            None,
            "a drive the prefix has no link for is not available"
        );
        // A settings file that climbs out is refused, not followed.
        assert_eq!(
            resolve_windows_path("C:\\Program Files\\..\\..\\Windows", &fs),
            None
        );
        fs::remove_dir_all(&prefix).ok();
    }
}
