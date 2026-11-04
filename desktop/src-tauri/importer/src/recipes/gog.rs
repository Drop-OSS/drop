//! GOG: the folders the GOG installers write.
//!
//! GOG has no launcher database to read the way Epic or Steam keep one: a
//! purchase installs through a per-game installer (or GOG Galaxy driving
//! the same installers), and what it leaves at the install site is the
//! game plus a `<app id>.gd` config file. The default location has been
//! stable for years - `GOG Games` on the system drive - so the recipe
//! reads the conventional roots and lets the shared executable rule tell
//! games from leftovers. Galaxy's own folder is excluded by name.

use std::collections::BTreeSet;
use std::path::PathBuf;

use super::{WindowsFs, collect_installs};

pub const LAUNCHER: &str = "gog";

/// Where GOG installers put games when nobody moves them.
const CONVENTIONAL_ROOTS: [&str; 3] = [
    "GOG Games",
    "Program Files (x86)/GOG Games",
    "Program Files/GOG Games",
];

/// Installs the GOG installers wrote into their usual places.
pub fn detect(fs: &WindowsFs, seen: &mut BTreeSet<PathBuf>, out: &mut Vec<super::DetectedInstall>) {
    if !fs.system_drive().is_dir() {
        return;
    }
    for name in CONVENTIONAL_ROOTS {
        collect_installs(LAUNCHER, &fs.system_drive().join(name), fs, seen, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("gd-importer-gog-{}-{name}", std::process::id()))
    }

    #[test]
    fn conventional_root_yields_games_and_the_galaxy_folder_does_not() {
        let prefix = temp("roots");
        let _ = std::fs::remove_dir_all(&prefix);
        let games = prefix.join("drive_c/GOG Games");
        let game = games.join("DOOM");
        std::fs::create_dir_all(&game).unwrap();
        std::fs::write(game.join("DOOMx64.exe"), b"MZ").unwrap();
        std::fs::write(game.join("1016787583.gd"), b"<GOGConfig/>").unwrap();
        // Galaxy's own folder sits in the same place and is not a game.
        let galaxy = games.join("GalaxyClient");
        std::fs::create_dir_all(galaxy.join("Redist")).unwrap();
        std::fs::write(galaxy.join("GalaxyClient.exe"), b"MZ").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        let titles: Vec<&str> = out.iter().map(|i| i.title.as_str()).collect();
        assert!(titles.contains(&"DOOM"), "the game is found: {titles:?}");
        assert!(
            !titles.contains(&"GalaxyClient"),
            "the launcher's own folder is not a game: {titles:?}"
        );
        assert_eq!(out[0].executable.as_deref(), Some("DOOMx64.exe"));
        assert!(out.iter().all(|i| i.launcher == LAUNCHER));
        std::fs::remove_dir_all(&prefix).ok();
    }
}
