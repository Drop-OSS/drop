use std::{collections::HashMap, path::PathBuf, str::FromStr};

#[cfg(target_os = "linux")]
use database::platform::Platform;
use database::{GameVersion, db::DATA_ROOT_DIR};
use log::warn;

use crate::error::BackupError;

use super::path::CommonPath;

pub struct BackupManager<'a> {
    pub current_platform: Platform,
    pub sources: HashMap<(Platform, Platform), &'a (dyn BackupHandler + Sync + Send)>,
}

impl Default for BackupManager<'_> {
    fn default() -> Self {
        Self::new()
    }
}

impl BackupManager<'_> {
    pub fn new() -> Self {
        BackupManager {
            #[cfg(target_os = "windows")]
            current_platform: Platform::Windows,

            #[cfg(target_os = "macos")]
            current_platform: Platform::macOS,

            #[cfg(target_os = "linux")]
            current_platform: Platform::Linux,

            sources: HashMap::from([
                // Current platform to target platform
                (
                    (Platform::Windows, Platform::Windows),
                    &WindowsBackupManager {} as &(dyn BackupHandler + Sync + Send),
                ),
                (
                    (Platform::Linux, Platform::Linux),
                    &LinuxBackupManager {} as &(dyn BackupHandler + Sync + Send),
                ),
                (
                    (Platform::macOS, Platform::macOS),
                    &MacBackupManager {} as &(dyn BackupHandler + Sync + Send),
                ),
            ]),
        }
    }
}

pub trait BackupHandler: Send + Sync {
    fn root_translate(&self, _path: &PathBuf, _game: &GameVersion) -> Result<PathBuf, BackupError> {
        Ok(DATA_ROOT_DIR.join("games"))
    }
    fn game_translate(&self, _path: &PathBuf, game: &GameVersion) -> Result<PathBuf, BackupError> {
        Ok(PathBuf::from_str(&game.game_id).unwrap())
    }
    fn base_translate(&self, path: &PathBuf, game: &GameVersion) -> Result<PathBuf, BackupError> {
        Ok(self
            .root_translate(path, game)?
            .join(self.game_translate(path, game)?))
    }
    fn home_translate(&self, _path: &PathBuf, _game: &GameVersion) -> Result<PathBuf, BackupError> {
        let c = CommonPath::Home.get().ok_or(BackupError::NotFound);
        println!("{:?}", c);
        c
    }
    fn store_user_id_translate(
        &self,
        _path: &PathBuf,
        game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        PathBuf::from_str(&game.game_id).map_err(|_| BackupError::ParseError)
    }
    fn os_user_name_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        Ok(PathBuf::from_str(&whoami::username()).unwrap())
    }
    fn win_app_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winAppData>");
        Err(BackupError::InvalidSystem)
    }
    fn win_local_app_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winLocalAppData>");
        Err(BackupError::InvalidSystem)
    }
    fn win_local_app_data_low_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winLocalAppDataLow>");
        Err(BackupError::InvalidSystem)
    }
    fn win_documents_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winDocuments>");
        Err(BackupError::InvalidSystem)
    }
    fn win_public_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winPublic>");
        Err(BackupError::InvalidSystem)
    }
    fn win_program_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winProgramData>");
        Err(BackupError::InvalidSystem)
    }
    fn win_dir_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected Windows Reference in Backup <winDir>");
        Err(BackupError::InvalidSystem)
    }
    fn xdg_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected XDG Reference in Backup <xdgData>");
        Err(BackupError::InvalidSystem)
    }
    fn xdg_config_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        warn!("Unexpected XDG Reference in Backup <xdgConfig>");
        Err(BackupError::InvalidSystem)
    }
    fn skip_translate(&self, _path: &PathBuf, _game: &GameVersion) -> Result<PathBuf, BackupError> {
        Ok(PathBuf::new())
    }
}

pub struct LinuxBackupManager {}
impl BackupHandler for LinuxBackupManager {
    fn xdg_config_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::Data.get().ok_or(BackupError::NotFound)
    }
    fn xdg_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::Config.get().ok_or(BackupError::NotFound)
    }
}
pub struct WindowsBackupManager {}
impl BackupHandler for WindowsBackupManager {
    fn win_app_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::Config.get().ok_or(BackupError::NotFound)
    }
    fn win_local_app_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::DataLocal.get().ok_or(BackupError::NotFound)
    }
    fn win_local_app_data_low_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::DataLocalLow.get().ok_or(BackupError::NotFound)
    }
    fn win_dir_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        Ok(PathBuf::from_str("C:/Windows").unwrap())
    }
    fn win_documents_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::Document.get().ok_or(BackupError::NotFound)
    }
    fn win_program_data_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        Ok(PathBuf::from_str("C:/ProgramData").unwrap())
    }
    fn win_public_translate(
        &self,
        _path: &PathBuf,
        _game: &GameVersion,
    ) -> Result<PathBuf, BackupError> {
        CommonPath::Public.get().ok_or(BackupError::NotFound)
    }
}
pub struct MacBackupManager {}
impl BackupHandler for MacBackupManager {}
