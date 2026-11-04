//! Rockstar Games Launcher: the folders it installs into.
//!
//! Rockstar keeps its install records in the registry and in a SQLite
//! database inside its own AppData - neither of which the file-only rule of
//! the recipes reaches, and neither of which says anything the folder
//! layout does not. The launcher installs into one folder per title under a
//! fixed root, and its own pieces (the Social Club runtime) live beside
//! those folders under names the shared launcher-folder rule excludes, so
//! the conventional roots plus the executable rule answer the question.

use std::collections::BTreeSet;
use std::path::PathBuf;

use super::{WindowsFs, collect_installs};

pub const LAUNCHER: &str = "rockstar";

/// Where the Rockstar launcher puts games when nobody moves them.
const CONVENTIONAL_ROOTS: [&str; 2] = [
    "Program Files/Rockstar Games",
    "Program Files (x86)/Rockstar Games",
];

/// Installs the Rockstar launcher wrote into its usual places.
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
        std::env::temp_dir().join(format!(
            "gd-importer-rockstar-{}-{name}",
            std::process::id()
        ))
    }

    #[test]
    fn games_are_found_and_the_social_club_runtime_is_not() {
        let prefix = temp("roots");
        let _ = std::fs::remove_dir_all(&prefix);
        let root = prefix.join("drive_c/Program Files/Rockstar Games");
        let game = root.join("Red Dead Redemption 2");
        std::fs::create_dir_all(game.join("RDR2")).unwrap();
        std::fs::write(game.join("RDR2Launcher.exe"), b"MZ").unwrap();
        std::fs::write(game.join("RDR2/RDR2.exe"), b"MZ").unwrap();
        // The launcher's own runtime, in the same root.
        let club = root.join("Social Club");
        std::fs::create_dir_all(&club).unwrap();
        std::fs::write(club.join("RockstarService.exe"), b"MZ").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        let titles: Vec<&str> = out.iter().map(|i| i.title.as_str()).collect();
        assert!(titles.contains(&"Red Dead Redemption 2"), "{titles:?}");
        assert!(!titles.contains(&"Social Club"), "{titles:?}");
        assert_eq!(out.len(), 1);
        assert_eq!(
            out[0].executable.as_deref(),
            Some("RDR2Launcher.exe"),
            "the shallowest executable is the entry point the player can correct"
        );
        std::fs::remove_dir_all(&prefix).ok();
    }
}
