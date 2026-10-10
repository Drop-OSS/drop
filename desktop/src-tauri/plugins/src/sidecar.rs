use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// App-data bin directory where the host stages a plugin's declared sidecar
/// binaries. `crate::plugin_system_run` resolves allowlisted bare names against
/// this directory when the binary is not found on the inherited `PATH`.
///
/// Returns `None` for plugin ids that are not a single safe path segment so a
/// plugin can never be used to traverse outside its own staging directory.
pub fn plugin_sidecar_bin_dir(app: &AppHandle, plugin_id: &str) -> Option<PathBuf> {
    if plugin_id.is_empty()
        || plugin_id.len() > 64
        || !plugin_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    app.path()
        .app_data_dir()
        .ok()
        .map(|root| root.join("plugins").join(plugin_id).join("bin"))
}
