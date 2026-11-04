//! Ubisoft Connect: the games folder its own settings file names.
//!
//! Ubisoft Connect keeps its settings in plain YAML at
//! `AppData/Local/Ubisoft Game Launcher/settings.yaml` (Roaming on older
//! installs), and under `misc:` it carries `game_installation_path` - the
//! one folder every game it installs lives directly under, forward slashes
//! and trailing slash included. Verified against a real prefix's file.
//! Per-game records live in a SQLite database inside the same directory;
//! the games folder and the executable rule make that unreadable database
//! unnecessary.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use super::{WindowsFs, collect_installs, resolve_windows_path};

pub const LAUNCHER: &str = "ubi";

/// Where Ubisoft Connect installs when its settings say nothing.
const CONVENTIONAL_ROOTS: [&str; 2] = [
    "Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games",
    "Program Files (x86)/Ubisoft games",
];

/// Installs Ubisoft Connect placed in its games folder.
pub fn detect(fs: &WindowsFs, seen: &mut BTreeSet<PathBuf>, out: &mut Vec<super::DetectedInstall>) {
    let system = fs.system_drive();
    if !system.is_dir() {
        return;
    }

    let mut roots: BTreeSet<PathBuf> = BTreeSet::new();

    // The folder the launcher's own settings name, per account.
    for appdata in fs
        .user_appdata_local()
        .into_iter()
        .chain(fs.user_appdata_roaming())
    {
        let settings = appdata.join("Ubisoft Game Launcher").join("settings.yaml");
        for value in setting_paths_in(&settings) {
            if let Some(mapped) = resolve_windows_path(&value, fs)
                && mapped.is_dir()
            {
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

    for root in roots {
        collect_installs(LAUNCHER, &root, fs, seen, out);
    }
}

/// The `game_installation_path` value in a settings.yaml, if it carries one.
///
/// YAML here is flatter than the format suggests: the launcher writes one
/// `key: value` per line, two-space-indented under its section, so a
/// line-shaped read is the whole parse this recipe needs. The value uses
/// forward slashes and usually keeps its trailing one.
fn setting_paths_in(settings: &Path) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(settings) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| {
            let (key, value) = line.trim().split_once(':')?;
            if key.trim() != "game_installation_path" {
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

    fn temp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("gd-importer-ubi-{}-{name}", std::process::id()))
    }

    #[test]
    fn the_settings_games_folder_is_the_install_root() {
        let prefix = temp("settings");
        let _ = std::fs::remove_dir_all(&prefix);
        let appdata = prefix.join("drive_c/users/steamuser/AppData/Local/Ubisoft Game Launcher");
        std::fs::create_dir_all(&appdata).unwrap();
        // The shape a real settings.yaml has, section nesting and all.
        std::fs::write(
            appdata.join("settings.yaml"),
            "\
autoPatching:
  enabled: true
misc:
  enable_auto_wall_posts: true
  game_installation_path: C:/Games/Ubisoft/
  screenshot_root_path: C:/users/steamuser/Pictures/UbisoftConnect/
",
        )
        .unwrap();
        let game = prefix.join("drive_c/Games/Ubisoft/Assassin's Creed Odyssey");
        std::fs::create_dir_all(game.join("ACOdyssey")).unwrap();
        std::fs::write(game.join("ACOdyssey.exe"), b"MZ").unwrap();
        // A leftover save folder the uninstaller forgot.
        let leftover = prefix.join("drive_c/Games/Ubisoft/The Division");
        std::fs::create_dir_all(&leftover).unwrap();
        std::fs::write(leftover.join("save.cfg"), b"x").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        let titles: Vec<&str> = out.iter().map(|i| i.title.as_str()).collect();
        assert!(
            titles.contains(&"Assassin's Creed Odyssey"),
            "the settings folder is searched: {titles:?}"
        );
        assert!(
            !titles.contains(&"The Division"),
            "a folder with no executable is not an install: {titles:?}"
        );
        assert_eq!(out[0].executable.as_deref(), Some("ACOdyssey.exe"));
        assert!(out.iter().all(|i| i.launcher == LAUNCHER));
        std::fs::remove_dir_all(&prefix).ok();
    }

    #[test]
    fn conventional_games_folder_is_searched_without_settings() {
        let prefix = temp("roots");
        let _ = std::fs::remove_dir_all(&prefix);
        let game = prefix
            .join("drive_c/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games/Rayman Legends");
        std::fs::create_dir_all(&game).unwrap();
        std::fs::write(game.join("rayman legends.exe"), b"MZ").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        assert_eq!(out.len(), 1, "{out:?}");
        assert_eq!(out[0].title, "Rayman Legends");
        std::fs::remove_dir_all(&prefix).ok();
    }
}
