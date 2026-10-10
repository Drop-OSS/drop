//! Server-backed host commands that back the client plugin UI/system surfaces.
//!
//! These live in the main crate (rather than the `plugins` crate) because they
//! need the authenticated HTTP client and URL builder owned by `remote`, while
//! the `plugins` crate owns the per-plugin allowlist and staging directory.

use std::fs;
use std::path::PathBuf;

use plugins::{PluginCommandAllowlist, plugin_sidecar_bin_dir, validate_command_name};
use remote::auth::generate_authorization_header;
use remote::requests::generate_url;
use remote::utils::DROP_CLIENT_ASYNC;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, State};

/// Fetch a client plugin's declared sidecar binary from the Drop server,
/// verify its SHA-256 and stage it into the plugin's app-data bin directory.
///
/// The bundle was checksummed by the server's plugin manager at install time;
/// this command re-verifies transit before any bytes are used, so
/// `plugin_system_run` can execute the staged binary by its allowlisted bare
/// name. The staged file name must itself be an allowlisted bare executable
/// name, so a plugin can never swap an allowlisted resolution onto another
/// binary.
#[tauri::command]
pub async fn plugin_sidecar_stage(
    app: AppHandle,
    plugin_id: String,
    name: String,
    asset: String,
    sha256: String,
    state: State<'_, PluginCommandAllowlist>,
) -> Result<PathBuf, String> {
    validate_command_name(&name)?;
    {
        let registry = state
            .0
            .lock()
            .map_err(|_| "plugin command registry poisoned".to_string())?;
        let allowed = registry
            .get(&plugin_id)
            .map(|set| set.contains(&name))
            .unwrap_or(false);
        if !allowed {
            return Err(format!(
                "sidecar '{name}' is not allowlisted for plugin '{plugin_id}'"
            ));
        }
    }

    if !sha256.chars().all(|c| c.is_ascii_hexdigit()) || sha256.len() != 64 {
        return Err(format!("invalid sha256 parameter: '{sha256}'"));
    }
    let asset = asset.trim_start_matches('/').trim_matches('/').to_string();
    if asset.is_empty()
        || asset.split('/').any(|part| {
            part.is_empty() || part == "." || part == ".." || part.starts_with('.')
        })
    {
        return Err(format!("invalid sidecar asset path: '{asset}'"));
    }

    let bin_dir = plugin_sidecar_bin_dir(&app, &plugin_id)
        .ok_or_else(|| format!("invalid plugin id '{plugin_id}'"))?;
    let url = generate_url(&["/api/v1/plugins", &plugin_id, "client", &asset], &[])
        .map_err(|err| format!("failed to build sidecar URL: {err:?}"))?;

    let response = DROP_CLIENT_ASYNC
        .get(url.to_string())
        .header("Authorization", generate_authorization_header())
        .send()
        .await
        .map_err(|err| format!("failed to fetch sidecar '{name}': {err}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "sidecar fetch for '{name}' failed with status {status}"
        ));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("failed to read sidecar '{name}': {err}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let digest = format!("{:x}", hasher.finalize());
    if !digest.eq_ignore_ascii_case(&sha256) {
        fs::remove_dir_all(&bin_dir).ok();
        return Err(format!(
            "sidecar '{name}' sha256 mismatch: expected {sha256}, got {digest}"
        ));
    }

    fs::create_dir_all(&bin_dir).map_err(|err| err.to_string())?;
    let staged = bin_dir.join(if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.clone()
    });
    // Never resolve or stage through symlinks: the staged tree stays plain.
    if fs::symlink_metadata(&staged)
        .map(|meta| meta.is_symlink())
        .unwrap_or(false)
    {
        fs::remove_file(&staged).map_err(|err| err.to_string())?;
    }
    let tmp = bin_dir.join(format!("{name}.staging-{}", std::process::id()));
    fs::write(&tmp, &bytes).map_err(|err| err.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o755))
            .map_err(|err| err.to_string())?;
    }
    fs::rename(&tmp, &staged).map_err(|err| err.to_string())?;

    Ok(staged)
}

/// Remove all staged sidecar binaries for a plugin (used at uninstall).
#[tauri::command]
pub fn plugin_sidecar_clear(app: AppHandle, plugin_id: String) -> Result<(), String> {
    let Some(bin_dir) = plugin_sidecar_bin_dir(&app, &plugin_id) else {
        return Ok(());
    };
    if bin_dir.exists() {
        fs::remove_dir_all(&bin_dir).map_err(|err| err.to_string())?;
    }
    Ok(())
}

/// Open an external URL in the user's default browser on behalf of a client
/// plugin (`ctx.ui.openExternal`). Restricted to http(s) so a plugin cannot
/// launch arbitrary local protocol handlers.
#[tauri::command]
pub fn plugin_open_external(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|err| err.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("refusing to open non-http(s) URL: {url}"));
    }

    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|err| err.to_string())
}
