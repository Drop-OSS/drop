use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tokio::process::Command as TokioCommand;

use crate::allowlist::{PluginCommandAllowlist, validate_command_name};
use crate::sidecar::plugin_sidecar_bin_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandOutput {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Register (replace) the allowlisted commands for a plugin.
///
/// # Security
///
/// Allowlisting a command means the plugin may execute it unsandboxed with the
/// user's privileges. Only register commands for plugins you fully trust; see
/// [`PluginCommandAllowlist`] for the trust model. There is intentionally no
/// blocklist of dangerous commands, so this allowlist is the only gate.
#[tauri::command]
pub fn plugin_register_commands(
    plugin_id: String,
    commands: Vec<String>,
    state: State<'_, PluginCommandAllowlist>,
) -> Result<(), String> {
    let mut registry = state
        .0
        .lock()
        .map_err(|_| "plugin command registry poisoned".to_string())?;
    let entry = registry.entry(plugin_id).or_default();
    entry.clear();
    for command in commands {
        let command = command.trim();
        if command.is_empty() {
            continue;
        }
        // Only bare executable names are allowed; no paths, so an allowlist
        // entry cannot be used to traverse to an arbitrary binary.
        if command.contains('/') || command.contains('\\') {
            return Err(format!(
                "allowlisted command must be a bare executable name: {command}"
            ));
        }
        validate_command_name(command)?;
        entry.insert(command.to_string());
    }
    Ok(())
}

/// Run an allowlisted native command for a plugin.
///
/// # Security
///
/// The binary is executed directly (no shell), so shell metacharacters are
/// never interpreted. However, allowlisted commands are **not sandboxed**:
/// they run with the same privileges as the Drop process and can read or write
/// anything the user can. This is why a command must be allowlisted per plugin
/// (fail-closed) and why only trusted plugins should ever be installed. Do not
/// rely on a blocklist to contain a malicious plugin; there is none by design.
#[tauri::command]
pub async fn plugin_system_run(
    app: AppHandle,
    plugin_id: String,
    bin: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    timeout_ms: Option<u64>,
    state: State<'_, PluginCommandAllowlist>,
) -> Result<CommandOutput, String> {
    validate_command_name(&bin)?;
    {
        let registry = state
            .0
            .lock()
            .map_err(|_| "plugin command registry poisoned".to_string())?;
        let allowed = registry
            .get(&plugin_id)
            .map(|set| set.contains(&bin))
            .unwrap_or(false);
        if !allowed {
            return Err(format!(
                "command '{bin}' is not allowlisted for plugin '{plugin_id}'"
            ));
        }
    }

    // Prefer a staged sidecar binary (sha256-verified when it was staged) when
    // the allowlisted name matches one. The staged tree is checked to be a
    // regular, non-symlink file; otherwise fall back to PATH resolution.
    let mut executable = PathBuf::from(&bin);
    if let Some(dir) = plugin_sidecar_bin_dir(&app, &plugin_id) {
        let candidate = dir.join(if cfg!(windows) {
            format!("{bin}.exe")
        } else {
            bin.clone()
        });
        let is_regular = fs::symlink_metadata(&candidate)
            .map(|meta| meta.is_file() && !meta.is_symlink())
            .unwrap_or(false);
        if is_regular {
            executable = candidate;
        }
    }

    let mut command = TokioCommand::new(&executable);
    command
        .args(args.unwrap_or_default())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }

    // Clamp to [1ms, 120s] so a plugin cannot request an unbounded process.
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(15_000).clamp(1, 120_000));
    let output = match tokio::time::timeout(timeout, command.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(err)) => return Err(format!("failed to run '{bin}': {err}")),
        Err(_) => return Err(format!("'{bin}' timed out after {}ms", timeout.as_millis())),
    };

    Ok(CommandOutput {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}
