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

use super::{WindowsFs, collect_installs, resolve_windows_path};

pub const LAUNCHER: &str = "ea";

/// The directory names EA has installed games into across its versions.
const CONVENTIONAL_ROOTS: [&str; 3] = [
    "Program Files/EA Games",
    "Program Files (x86)/EA Games",
    "EA Games",
];

/// Installs the EA app put on this Windows filesystem.
pub fn detect(fs: &WindowsFs, seen: &mut BTreeSet<PathBuf>, out: &mut Vec<super::DetectedInstall>) {
    for root in install_roots(fs) {
        collect_installs(LAUNCHER, &root, fs, seen, out);
    }
}

/// The directories an EA install may live directly under.
fn install_roots(fs: &WindowsFs) -> Vec<PathBuf> {
    let mut roots: BTreeSet<PathBuf> = BTreeSet::new();
    let system = fs.system_drive();
    if !system.is_dir() {
        return Vec::new();
    }

    for ini in ea_ini_files(fs) {
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

/// The INI locations EA keeps install settings in, if they exist: the
/// machine-wide file, plus one per signed-in account named by EA's user id.
fn ea_ini_files(fs: &WindowsFs) -> Vec<PathBuf> {
    let mut files = Vec::new();

    let machine = fs
        .system_drive()
        .join("ProgramData")
        .join("EA Desktop")
        .join("machine.ini");
    if machine.is_file() {
        files.push(machine);
    }

    for appdata in fs.user_appdata_local() {
        let dir = appdata.join("Electronic Arts").join("EA Desktop");
        // `fs` is the parameter here, so the stdlib call is spelled out.
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with("user_") && name.ends_with(".ini") {
                files.push(path);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipes::DetectedInstall;

    fn detect_only(fs: &WindowsFs) -> Vec<DetectedInstall> {
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(fs, &mut seen, &mut out);
        out
    }

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
            // The prerequisite a launcher left next to the game must not be
            // mistaken for the game itself.
            fs::write(game.join("dxsetup.exe"), b"MZ").unwrap();
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
            let found = detect_only(fs);
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
            let by_title = |t: &str| {
                found
                    .iter()
                    .find(|i| i.title == t)
                    .and_then(|i| i.executable.as_deref())
            };
            assert_eq!(
                by_title("Need for Speed Heat"),
                Some("NFSHeat.exe"),
                "the root executable wins even when a setup stub sits beside it"
            );
            assert_eq!(
                by_title("Star Wars Jedi"),
                Some("StarWarsJD/jedi.exe"),
                "a deeper folder is searched when the root holds no entry point"
            );
            assert_eq!(
                by_title("Battlefield V"),
                Some("BFV.exe"),
                "installs on the other drive get an executable too"
            );
            assert!(
                found.iter().all(|i| i.prefix.as_deref() == Some(prefix)),
                "every install found in a prefix says which one"
            );
        });
    }

    #[test]
    fn a_missing_prefix_finds_nothing() {
        let found = detect_only(&WindowsFs::Prefix(PathBuf::from("/nonexistent/prefix")));
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
