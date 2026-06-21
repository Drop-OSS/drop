use std::{
    fs::create_dir_all,
    path::{Path, PathBuf},
    process::Command,
};

use client::compat::{COMPAT_INFO, UMU_LAUNCHER_EXECUTABLE};
use database::{
    Database, DownloadableMetadata, GameVersion, db::DATA_ROOT_DIR, platform::Platform,
};

use crate::{error::ProcessError, parser::ParsedCommand, process_manager::ProcessHandler};

pub struct MacLauncher;
impl ProcessHandler for MacLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        _current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        Ok(launch_command)
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    fn modify_command(&self, _command: &mut Command) {}

    fn id(&self) -> &'static str {
        "macos"
    }

    fn name(&self) -> &'static str {
        "Direct"
    }

    fn description(&self) -> &'static str {
        "Launches the game directly on macOS."
    }
}

#[allow(dead_code)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg_attr(not(target_os = "windows"), allow(unused_variables))]
fn apply_no_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

enum WindowsLaunchStrategy {
    Direct,
    Cmd,
    Powershell,
}

// Wrap a launch command for Windows; with no strategy, detect it from the file extension.
fn windows_launch_command(
    launch_command: String,
    current_dir: &str,
    strategy: Option<WindowsLaunchStrategy>,
) -> Result<String, ProcessError> {
    let mut parsed = ParsedCommand::parse(launch_command)?;

    let strategy = strategy.unwrap_or_else(|| {
        let extension = Path::new(&parsed.command)
            .extension()
            .and_then(|ext| ext.to_str())
            .map(str::to_ascii_lowercase);
        match extension.as_deref() {
            Some("ps1") => WindowsLaunchStrategy::Powershell,
            Some("exe") | Some("com") => WindowsLaunchStrategy::Direct,
            _ => WindowsLaunchStrategy::Cmd,
        }
    });

    match strategy {
        // PowerShell scripts
        WindowsLaunchStrategy::Powershell => {
            parsed.make_absolute(PathBuf::from(current_dir));
            let script = std::mem::replace(&mut parsed.command, "powershell".to_owned());
            let mut args = vec![
                "-NoProfile".to_owned(),
                "-ExecutionPolicy".to_owned(),
                "Bypass".to_owned(),
                "-File".to_owned(),
                script,
            ];
            args.append(&mut parsed.args);
            parsed.args = args;
        }
        // Direct executables
        WindowsLaunchStrategy::Direct => {
            parsed.make_absolute(PathBuf::from(current_dir));
        }
        // cmd.exe, for batch files, builtins, PATHEXT resolution, %VAR% expansion, etc.
        WindowsLaunchStrategy::Cmd => {
            let command = std::mem::replace(&mut parsed.command, "cmd".to_owned());
            let mut args = vec!["/C".to_owned(), command];
            args.append(&mut parsed.args);
            parsed.args = args;
        }
    }

    Ok(parsed.reconstruct())
}

pub struct WindowsLauncher;
impl ProcessHandler for WindowsLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        windows_launch_command(launch_command, current_dir, None)
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    fn modify_command(&self, command: &mut Command) {
        apply_no_window(command);
    }

    fn id(&self) -> &'static str {
        "windows-auto"
    }

    fn name(&self) -> &'static str {
        "Automatic"
    }

    fn description(&self) -> &'static str {
        "Detects the file type and launches it directly, or through cmd or PowerShell."
    }
}

pub struct WindowsDirectLauncher;
impl ProcessHandler for WindowsDirectLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        windows_launch_command(launch_command, current_dir, Some(WindowsLaunchStrategy::Direct))
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    fn modify_command(&self, command: &mut Command) {
        apply_no_window(command);
    }

    fn id(&self) -> &'static str {
        "windows-direct"
    }

    fn name(&self) -> &'static str {
        "Direct executable"
    }

    fn description(&self) -> &'static str {
        "Runs the executable directly, without a shell."
    }
}

pub struct WindowsCmdLauncher;
impl ProcessHandler for WindowsCmdLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        windows_launch_command(launch_command, current_dir, Some(WindowsLaunchStrategy::Cmd))
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    fn modify_command(&self, command: &mut Command) {
        apply_no_window(command);
    }

    fn id(&self) -> &'static str {
        "windows-cmd"
    }

    fn name(&self) -> &'static str {
        "Command Prompt (cmd)"
    }

    fn description(&self) -> &'static str {
        "Launches through cmd.exe. Supports batch files, builtins and %VAR% expansion."
    }
}

pub struct WindowsPowershellLauncher;
impl ProcessHandler for WindowsPowershellLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        windows_launch_command(
            launch_command,
            current_dir,
            Some(WindowsLaunchStrategy::Powershell),
        )
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    fn modify_command(&self, command: &mut Command) {
        apply_no_window(command);
    }

    fn id(&self) -> &'static str {
        "windows-powershell"
    }

    fn name(&self) -> &'static str {
        "PowerShell"
    }

    fn description(&self) -> &'static str {
        "Runs the command as a PowerShell script (-File)."
    }
}

pub struct LinuxNativeLauncher;
impl ProcessHandler for LinuxNativeLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        _current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        // Run native Linux games directly, no umu-run wrapper
        Ok(launch_command)
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    fn modify_command(&self, _command: &mut Command) {}

    fn id(&self) -> &'static str {
        "linux-native"
    }

    fn name(&self) -> &'static str {
        "Native (direct)"
    }

    fn description(&self) -> &'static str {
        "Runs the native Linux game directly on the host."
    }
}

pub struct UMUNativeLauncher;
impl ProcessHandler for UMUNativeLauncher {
    fn create_launch_process(
        &self,
        meta: &DownloadableMetadata,
        launch_command: String,
        game_version: &GameVersion,
        _current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        let umu_id_override = game_version
            .launches
            .iter()
            .find(|v| v.platform == meta.target_platform)
            .and_then(|v| v.umu_id_override.as_ref())
            .map_or("", |v| v);

        let game_id = if umu_id_override.is_empty() {
            &game_version.version_id
        } else {
            umu_id_override
        };

        let pfx_dir = DATA_ROOT_DIR.join("pfx");
        let pfx_dir = pfx_dir.join(meta.id.clone());
        create_dir_all(&pfx_dir)?;

        Ok(format!(
            "GAMEID={game_id} UMU_NO_PROTON=1 WINEPREFIX={} {umu:?} {launch}",
            pfx_dir.to_string_lossy(),
            umu = UMU_LAUNCHER_EXECUTABLE
                .as_ref()
                .expect("Failed to get UMU_LAUNCHER_EXECUTABLE as ref"),
            launch = launch_command,
        ))
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        let Some(compat_info) = &*COMPAT_INFO else {
            return false;
        };
        compat_info.umu_installed
    }

    fn modify_command(&self, _command: &mut Command) {}

    fn id(&self) -> &'static str {
        "linux-umu"
    }

    fn name(&self) -> &'static str {
        "Steam Linux Runtime (umu-run)"
    }

    fn description(&self) -> &'static str {
        "Runs the native Linux game inside umu-run's Steam Linux Runtime."
    }
}

pub struct UMUCompatLauncher;
impl ProcessHandler for UMUCompatLauncher {
    fn create_launch_process(
        &self,
        meta: &DownloadableMetadata,
        launch_command: String,
        game_version: &GameVersion,
        _current_dir: &str,
        database: &Database,
    ) -> Result<String, ProcessError> {
        let umu_id_override = game_version
            .launches
            .iter()
            .find(|v| v.platform == meta.target_platform)
            .and_then(|v| v.umu_id_override.as_ref())
            .map_or("", |v| v);

        let game_id = if umu_id_override.is_empty() {
            &game_version.version_id
        } else {
            umu_id_override
        };

        let pfx_dir = DATA_ROOT_DIR.join("pfx");
        let pfx_dir = pfx_dir.join(meta.id.clone());
        create_dir_all(&pfx_dir)?;

        let proton_path = game_version
            .user_configuration
            .override_proton_path
            .as_ref()
            .or(database.applications.default_proton_path.as_ref())
            .ok_or(ProcessError::NoCompat)?;

        #[cfg(target_os = "linux")]
        let proton_valid = crate::compat::read_proton_path(PathBuf::from(proton_path))
            .ok()
            .flatten()
            .is_some();
        #[cfg(not(target_os = "linux"))]
        let proton_valid = false;
        if !proton_valid {
            return Err(ProcessError::NoCompat);
        }
        let proton_env = format!("PROTONPATH={}", proton_path);

        Ok(format!(
            "GAMEID={game_id} {} WINEPREFIX={} {umu:?} {launch}",
            proton_env,
            pfx_dir.to_string_lossy(),
            umu = UMU_LAUNCHER_EXECUTABLE
                .as_ref()
                .expect("Failed to get UMU_LAUNCHER_EXECUTABLE as ref"),
            launch = launch_command,
        ))
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        let Some(compat_info) = &*COMPAT_INFO else {
            return false;
        };
        compat_info.umu_installed
    }

    fn modify_command(&self, _command: &mut Command) {}

    fn id(&self) -> &'static str {
        "proton-umu"
    }

    fn name(&self) -> &'static str {
        "Proton (umu-run)"
    }

    fn description(&self) -> &'static str {
        "Runs the Windows game through Proton using umu-run."
    }
}

pub struct AsahiMuvmLauncher;
impl ProcessHandler for AsahiMuvmLauncher {
    fn create_launch_process(
        &self,
        meta: &DownloadableMetadata,
        launch_command: String,
        game_version: &GameVersion,
        current_dir: &str,
        database: &Database,
    ) -> Result<String, ProcessError> {
        let umu_launcher = UMUCompatLauncher {};
        let umu_string = umu_launcher.create_launch_process(
            meta,
            launch_command,
            game_version,
            current_dir,
            database,
        )?;
        let mut args_cmd = umu_string
            .split("umu-run")
            .collect::<Vec<&str>>()
            .into_iter();
        let args = args_cmd
            .next()
            .ok_or(ProcessError::InvalidArguments(umu_string.clone()))?
            .trim();
        let cmd = format!(
            "umu-run{}",
            args_cmd
                .next()
                .ok_or(ProcessError::InvalidArguments(umu_string.clone()))?
        );

        Ok(format!("{args} muvm -- {cmd}"))
    }

    #[allow(unreachable_code)]
    #[allow(unused_variables)]
    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        #[cfg(not(target_os = "linux"))]
        return false;

        #[cfg(not(target_arch = "aarch64"))]
        return false;

        let page_size = page_size::get();
        if page_size != 16384 {
            return false;
        }

        let Some(compat_info) = &*COMPAT_INFO else {
            return false;
        };

        compat_info.umu_installed
    }

    fn modify_command(&self, _command: &mut Command) {}

    fn id(&self) -> &'static str {
        "proton-muvm"
    }

    fn name(&self) -> &'static str {
        "Proton + muvm (Asahi)"
    }

    fn description(&self) -> &'static str {
        "Runs through Proton inside a muvm microVM, for Apple Silicon / Asahi Linux."
    }
}
