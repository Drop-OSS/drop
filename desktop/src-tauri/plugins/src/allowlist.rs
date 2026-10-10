use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

/// Per-plugin allowlist of bare executable names a client plugin may run via
/// `ctx.system.run`. Populated from `manifest.client.commands` by the host when
/// a plugin is registered; the Tauri command layer is the enforcement point so
/// a plugin cannot bypass it from the webview.
///
/// # Security
///
/// This allowlist is **fail-closed**: a command that is not explicitly
/// registered for a plugin is always rejected by [`crate::plugin_system_run`].
///
/// There is deliberately **no blocklist** of "dangerous" commands. Blocklists
/// are trivially bypassed (renamed binaries, wrapper scripts, aliases) and
/// silently reject legitimate tooling, so the host does not pretend they
/// provide a security boundary.
///
/// That means an allowlisted command is a deliberate trust decision by the
/// user/host: it is executed **directly, unsandboxed, with the full privileges
/// of the user running Drop**. A malicious plugin that gets a command into its
/// allowlist can do anything the user can do.
///
/// **Only install plugins you fully trust.**
#[derive(Default)]
pub struct PluginCommandAllowlist(pub Mutex<HashMap<String, HashSet<String>>>);

/// Validate the shape of a command name.
///
/// Only bare executable names are allowed (no path separators, no leading `.`
/// or `-`, ASCII alphanumerics plus `_`, `-`, `.`). This is a syntax check,
/// not a trust decision: trust comes from the per-plugin allowlist itself.
pub fn validate_command_name(command: &str) -> Result<(), String> {
    if command.is_empty() || command.len() > 64 {
        return Err(format!("invalid command length: '{command}'"));
    }
    if command.starts_with('.') || command.starts_with('-') {
        return Err(format!("command cannot start with '.' or '-': '{command}'"));
    }
    if !command
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(format!(
            "command contains disallowed characters (only alphanumeric, _, -, . allowed): '{command}'"
        ));
    }
    Ok(())
}
