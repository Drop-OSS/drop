use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::game_fs::get_game_install_dir;
use crate::path_guard;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedExecutable {
    pub relative_path: String,
    pub sha256: String,
    pub size: u64,
}

fn compute_file_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
pub async fn plugin_game_scan_executables(
    game_id: String,
) -> Result<Vec<ScannedExecutable>, String> {
    let install_dir = get_game_install_dir(&game_id)?;
    let mut executables = Vec::new();

    for entry in WalkDir::new(&install_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        // Never follow or scan symlinks for executable security
        if path_guard::is_symlink(path) {
            continue;
        }

        let is_exec = if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            let lower = ext.to_lowercase();
            matches!(
                lower.as_str(),
                "exe" | "dll" | "so" | "bin" | "x86_64" | "elf" | "dylib"
            )
        } else {
            false
        };

        #[cfg(unix)]
        let is_exec = is_exec || {
            use std::os::unix::fs::PermissionsExt;
            entry
                .metadata()
                .map(|m| (m.permissions().mode() & 0o111) != 0)
                .unwrap_or(false)
        };

        if is_exec && let Ok(rel_path) = path.strip_prefix(&install_dir) {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let sha256 =
                compute_file_sha256(path).unwrap_or_else(|_| String::from("unknown-sha256"));

            executables.push(ScannedExecutable {
                relative_path: rel_path.to_string_lossy().to_string(),
                sha256,
                size,
            });
        }
    }

    Ok(executables)
}

/// Find files inside an installed game whose relative path contains any of the
/// supplied patterns (case-insensitive substring). The host is deliberately
/// agnostic about what the patterns mean, so domain knowledge (e.g. which paths
/// indicate a particular anti-cheat or compatibility tool) lives in the calling
/// plugin, not in core. Symlinks are never followed.
#[tauri::command]
pub async fn plugin_game_find_files(
    game_id: String,
    patterns: Vec<String>,
) -> Result<Vec<String>, String> {
    let install_dir = get_game_install_dir(&game_id)?;

    let normalized: Vec<String> = patterns
        .into_iter()
        .map(|pattern| pattern.trim().to_ascii_lowercase())
        .filter(|pattern| !pattern.is_empty() && pattern.len() <= 128)
        .collect();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let mut matches = Vec::new();
    for entry in WalkDir::new(&install_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || path_guard::is_symlink(path) {
            continue;
        }

        let Ok(rel) = path.strip_prefix(&install_dir) else {
            continue;
        };
        let rel_str = rel.to_string_lossy().to_ascii_lowercase();
        if normalized.iter().any(|pattern| rel_str.contains(pattern)) {
            matches.push(rel.to_string_lossy().to_string());
        }
    }

    Ok(matches)
}
