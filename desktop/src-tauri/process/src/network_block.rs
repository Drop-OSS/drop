use log::info;

#[cfg(target_os = "linux")]
pub fn check_unshare_available() -> bool {
    // Check if user namespaces are enabled
    let max_user_namespaces = std::fs::read_to_string("/proc/sys/user/max_user_namespaces")
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok())
        .unwrap_or(0);

    if max_user_namespaces == 0 {
        info!("User namespaces are disabled, network blocking is not available");
        return false;
    }

    // Check if unshare binary exists
    which::which("unshare").is_ok()
}

#[cfg(not(target_os = "linux"))]
pub fn check_unshare_available() -> bool {
    false
}

/// Wrap a launch command with network blocking for the current platform.
/// Returns the modified command string, or the original if blocking is not supported.
pub fn wrap_with_network_blocking(launch_command: &str) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        if !check_unshare_available() {
            return Err("unshare not available".to_string());
        }
        Ok(format!("unshare -r -n {}", launch_command))
    }

    #[cfg(target_os = "windows")]
    {
        // Windows AppContainer support is more complex and requires
        // CreateAppContainerProfile + CreateProcessW with security capabilities.
        // For now, return an error to indicate manual handling is needed.
        Err("AppContainer network blocking not yet implemented".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        // No good unprivileged option on macOS
        Err("Network blocking not supported on macOS".to_string())
    }
}
