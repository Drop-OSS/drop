use std::{
    fmt::Display,
    io::{self, Error},
    sync::Arc,
};

use serde_with::SerializeDisplay;

#[derive(SerializeDisplay, Clone)]
pub enum ProcessError {
    NotInstalled,
    AlreadyRunning,
    InvalidID,
    InvalidVersion,
    RequiredDependency(String, String),
    IOError(Arc<Error>),
    FormatError(String), // String errors supremacy
    InvalidPlatform,
    OpenerError(Arc<tauri_plugin_opener::Error>),
    InvalidArguments(String),
    FailedLaunch(String),
    NotExecutable(String),
    NoCompat,
}

impl Display for ProcessError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ProcessError::NotInstalled => "Game not installed",
            ProcessError::AlreadyRunning => "Game already running",
            ProcessError::InvalidID => "Invalid game ID",
            ProcessError::InvalidVersion => "Invalid game version",
            ProcessError::IOError(error) => &error.to_string(),
            ProcessError::InvalidPlatform => "This game cannot be played on the current platform",
            ProcessError::FormatError(error) => &format!("Could not format template: {error:?}"),
            ProcessError::OpenerError(error) => &format!("Could not open directory: {error:?}"),
            ProcessError::InvalidArguments(arguments) => {
                &format!("Invalid arguments in command {arguments}")
            }
            ProcessError::FailedLaunch(game_id) => {
                &format!("Drop detected that the game {game_id} may have failed to launch properly")
            }
            ProcessError::NotExecutable(command) => {
                &format!("The command '{command}' exists but is not marked as executable")
            }
            ProcessError::RequiredDependency(game_id, version_id) => &format!(
                "Missing a required dependency to launch this game: {} {}",
                game_id, version_id
            ),
            ProcessError::NoCompat => "No Proton compatibility layer could be found for this tool. Add an override or set your global default in settings.",
        };
        write!(f, "{s}")
    }
}

impl From<io::Error> for ProcessError {
    fn from(value: io::Error) -> Self {
        ProcessError::IOError(Arc::new(value))
    }
}
