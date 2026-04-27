use std::{fs::create_dir_all, path::PathBuf, process::Command};

use client::compat::{COMPAT_INFO, UMU_LAUNCHER_EXECUTABLE};
use database::{
    Database, DownloadableMetadata, GameVersion, db::DATA_ROOT_DIR, platform::Platform,
};

use crate::{error::ProcessError, process_manager::ProcessHandler};

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
}

#[allow(dead_code)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct WindowsLauncher;
impl ProcessHandler for WindowsLauncher {
    fn create_launch_process(
        &self,
        _meta: &DownloadableMetadata,
        launch_command: String,
        _game_version: &GameVersion,
        _current_dir: &str,
        _database: &Database,
    ) -> Result<String, ProcessError> {
        Ok(format!("pwsh \"cmd /C \"{}\"\"", launch_command))
    }

    fn valid_for_platform(&self, _db: &Database, _target: &Platform) -> bool {
        true
    }

    #[allow(unused_variables)]
    fn modify_command(&self, command: &mut Command) {
        #[cfg(target_os = "windows")]
        use std::os::windows::process::CommandExt;
        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);
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
}
