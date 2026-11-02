//! Parsing of the curated Ludusavi save manifest as the server stores it in
//! `SaveManifest.entry`.
//!
//! Two shapes are accepted, because real Ludusavi data and our own seed rows
//! differ:
//!
//! ```text
//! { "files": { "<template path>": { "tags": ["save"], "condition": "os: win" } },
//!   "installDir": { "Game Name": {} } }                    // map form (server seeds)
//!
//! { "files": [{ "path": "<template path>", "tags": [...], "condition": "..." }],
//!   "installDir": ["Game Name"] }                          // array form (Ludusavi)
//! ```
//!
//! Conditions are Ludusavi's `key: value` pairs joined by `and`. v1 enforces
//! only `os:`; `store:`/`user:`/`prefix:` are treated as matching (the desktop
//! has no per-store user concept yet, and refusing entries on unknown keys
//! would make real manifests sync nothing). An *unknown* condition key fails
//! closed. Registry entries are v2 and ignored. One unusable path fails the
//! whole manifest: a manifest that contains one insane path is not trusted
//! for the rest either.

use std::fmt;

use database::platform::Platform;
use serde::Deserialize;
use serde_json::Value;

use crate::error::SaveError;
use crate::normalise::{normalize, usable};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TargetOs {
    Windows,
    Linux,
    MacOS,
}

impl fmt::Display for TargetOs {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            TargetOs::Windows => "win",
            TargetOs::Linux => "linux",
            TargetOs::MacOS => "osx",
        })
    }
}

impl TargetOs {
    fn parse(value: &str) -> Option<TargetOs> {
        match value.trim().to_ascii_lowercase().as_str() {
            "win" | "windows" => Some(TargetOs::Windows),
            "linux" => Some(TargetOs::Linux),
            "osx" | "macos" | "mac" => Some(TargetOs::MacOS),
            _ => None,
        }
    }

    /// The OS whose save layout a file entry describes, matched against the
    /// effective execution environment of the game: a Windows game under a
    /// Proton prefix counts as Windows.
    pub fn effective(host: Platform, game_target: Platform) -> TargetOs {
        match host {
            Platform::Windows => TargetOs::Windows,
            Platform::macOS => TargetOs::MacOS,
            Platform::Linux => match game_target {
                Platform::Windows => TargetOs::Windows, // Proton prefix
                _ => TargetOs::Linux,
            },
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ManifestFile {
    /// Normalised template, e.g. `<winDocuments>/My Game/saves/*.sav`.
    pub template: String,
    pub tags: Vec<String>,
    /// `None` = applies on every OS.
    pub os: Option<TargetOs>,
}

/// The parsed manifest for one game, plus the identity of the exact entry
/// bytes it came from (`entryHash`) - echoed back on upload as
/// `X-Manifest-Hash` so the server timeline records which manifest produced
/// each version.
#[derive(Clone, Debug)]
pub struct SaveManifest {
    pub entry_hash: String,
    pub ludusavi_name: Option<String>,
    pub files: Vec<ManifestFile>,
    /// `<game>` install directory tails from `installDir` (sorted; first wins
    /// when several are listed).
    pub install_dirs: Vec<String>,
}

/// `GET /api/v1/client/saves/manifests/{gameId}` response.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestResponse {
    pub game_id: String,
    pub entry: Value,
    pub source: String,
    pub ludusavi_name: Option<String>,
    pub entry_hash: String,
}

impl SaveManifest {
    pub fn from_response(response: &ManifestResponse) -> Result<SaveManifest, SaveError> {
        let entry = response
            .entry
            .as_object()
            .ok_or_else(|| SaveError::Manifest("entry is not an object".into()))?;

        let mut files = Vec::new();
        match entry.get("files") {
            Some(Value::Object(map)) => {
                for (path, attrs) in map {
                    let (tags, condition) = match attrs {
                        Value::Object(attrs) => (
                            string_list(attrs.get("tags")),
                            attrs
                                .get("condition")
                                .and_then(Value::as_str)
                                .map(str::to_string),
                        ),
                        Value::Null => (Vec::new(), None),
                        _ => {
                            return Err(SaveError::Manifest(format!(
                                "file attributes for {path} are not an object"
                            )));
                        }
                    };
                    files.push(parse_file(path, tags, condition.as_deref())?);
                }
            }
            Some(Value::Array(items)) => {
                for item in items {
                    match item {
                        Value::String(path) => files.push(parse_file(path, Vec::new(), None)?),
                        Value::Object(obj) => {
                            let path =
                                obj.get("path").and_then(Value::as_str).ok_or_else(|| {
                                    SaveError::Manifest("files item has no path".into())
                                })?;
                            files.push(parse_file(
                                path,
                                string_list(obj.get("tags")),
                                obj.get("condition").and_then(Value::as_str),
                            )?);
                        }
                        _ => {
                            return Err(SaveError::Manifest(
                                "files array item is neither string nor object".into(),
                            ));
                        }
                    }
                }
            }
            Some(Value::Null) | None => {}
            Some(_) => return Err(SaveError::Manifest("files is neither map nor array".into())),
        }

        let mut install_dirs = Vec::new();
        match entry.get("installDir") {
            Some(Value::Object(map)) => {
                for key in map.keys() {
                    install_dirs.push(key.clone());
                }
            }
            Some(Value::Array(items)) => {
                for item in items {
                    match item {
                        Value::String(path) => install_dirs.push(path.clone()),
                        Value::Object(obj) => {
                            if let Some(path) = obj.get("path").and_then(Value::as_str) {
                                install_dirs.push(path.to_string());
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
        install_dirs.sort();
        install_dirs.dedup();
        files.sort_by(|a, b| a.template.cmp(&b.template));

        Ok(SaveManifest {
            entry_hash: response.entry_hash.clone(),
            ludusavi_name: response.ludusavi_name.clone(),
            files,
            install_dirs,
        })
    }

    /// Entries that apply to an execution environment.
    pub fn applicable(&self, environment: TargetOs) -> Vec<&ManifestFile> {
        self.files
            .iter()
            .filter(|file| file.os.is_none_or(|os| os == environment))
            .collect()
    }
}

fn string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn parse_file(
    path: &str,
    tags: Vec<String>,
    condition: Option<&str>,
) -> Result<ManifestFile, SaveError> {
    // normalize() folds Windows-style paths (`%APPDATA%`, backslashes,
    // `<home>/Documents`) into placeholders; per-OS applicability comes from
    // the condition, so normalizing every entry permissively is correct.
    let template = normalize(path, Platform::Windows);
    if !usable(&template) {
        // Too broad / unprintable / relative - the same guard Ludusavi uses
        // to avoid "save everything under Documents" disasters.
        return Err(SaveError::Manifest(format!(
            "unusable save path {path:?} (normalized {template:?})"
        )));
    }
    Ok(ManifestFile {
        template,
        tags,
        os: condition.and_then(parse_os_condition),
    })
}

fn parse_os_condition(condition: &str) -> Option<TargetOs> {
    for clause in condition.to_ascii_lowercase().split(" and ") {
        let Some((key, value)) = clause.trim().split_once(':') else {
            continue;
        };
        match key.trim() {
            "os" => {
                // An os: value we cannot read is treated as "not runnable
                // here" rather than "applies everywhere".
                return Some(TargetOs::parse(value).unwrap_or(TargetOs::MacOS));
            }
            // store/user/prefix: treated as matching (see module docs).
            "store" | "user" | "prefix" => continue,
            // Unknown keys fail closed. MacOS matches nothing we execute v1
            // saves on (Linux native and Proton prefixes).
            _ => return Some(TargetOs::MacOS),
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(entry: Value) -> SaveManifest {
        SaveManifest::from_response(&ManifestResponse {
            game_id: "g".into(),
            entry,
            source: "curated".into(),
            ludusavi_name: Some("Game".into()),
            entry_hash: "e".repeat(64),
        })
        .unwrap()
    }

    #[test]
    fn map_form() {
        let manifest = parse(serde_json::json!({
            "files": {
                "<xdgData>/My Game/save": { "tags": ["save"] },
                "<winDocuments>/My Game/save": { "tags": ["save"], "condition": "os: win" },
            },
            "installDir": { "My Game": {} },
        }));
        assert_eq!(manifest.files.len(), 2);
        assert_eq!(manifest.install_dirs, vec!["My Game".to_string()]);
        let win = manifest
            .files
            .iter()
            .find(|f| f.template.contains("winDocuments"))
            .unwrap();
        assert_eq!(win.os, Some(TargetOs::Windows));
        let both = manifest.files.iter().find(|f| f.os.is_none()).unwrap();
        assert_eq!(both.tags, vec!["save".to_string()]);

        // A Proton game (Linux host, Windows target) is a Windows environment:
        // only the unconditional and the win entries apply.
        let applied: Vec<_> = TargetOs::effective(Platform::Linux, Platform::Windows)
            .to_string()
            .chars()
            .collect();
        assert_eq!(applied, vec!['w', 'i', 'n']);
        let applicable =
            manifest.applicable(TargetOs::effective(Platform::Linux, Platform::Windows));
        assert_eq!(applicable.len(), 2);
        let applicable = manifest.applicable(TargetOs::effective(Platform::Linux, Platform::Linux));
        assert_eq!(applicable.len(), 1);
    }

    #[test]
    fn array_form_with_windows_paths() {
        let manifest = parse(serde_json::json!({
            "files": [
                { "path": "%APPDATA%/My Game/save.dat", "tags": ["save"], "condition": "os: win" },
                { "path": "~\\Documents\\My Game\\saves", "condition": "os: win" },
                "~/.config/My Game/config",
            ],
            "installDir": ["My Game"],
        }));
        // normalize() must have folded all three into placeholders.
        assert!(
            manifest
                .files
                .iter()
                .any(|f| f.template.starts_with("<winAppData>/My Game/save.dat"))
        );
        assert!(manifest.files.iter().any(|f| {
            f.template.starts_with("<winDocuments>/My Game/saves")
                && f.os == Some(TargetOs::Windows)
        }));
        assert!(
            manifest
                .files
                .iter()
                .any(|f| f.template.starts_with("<home>/.config/My Game/config") && f.os.is_none())
        );
    }

    #[test]
    fn unknown_condition_key_excludes_the_entry() {
        let manifest = parse(serde_json::json!({
            "files": [{ "path": "<xdgData>/G/s", "condition": "vr: steam" }],
        }));
        assert_eq!(manifest.files[0].os, Some(TargetOs::MacOS)); // matches nothing
    }

    #[test]
    fn unusable_paths_fail_the_whole_manifest() {
        // A manifest we do not fully trust is not partially applied.
        let err = SaveManifest::from_response(&ManifestResponse {
            game_id: "g".into(),
            entry: serde_json::json!({ "files": [{ "path": "~" }] }),
            source: "curated".into(),
            ludusavi_name: None,
            entry_hash: "e".repeat(64),
        });
        assert!(matches!(err, Err(SaveError::Manifest(_))));
    }
}
