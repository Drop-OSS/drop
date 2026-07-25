use humansize::{BINARY, format_size};
use std::{
    fmt::{Display, Formatter},
    io,
    path::StripPrefixError,
    sync::{Arc, mpsc::SendError},
};

use remote::error::RemoteAccessError;
use serde_with::SerializeDisplay;

#[derive(SerializeDisplay)]
pub enum DownloadManagerError<T> {
    IOError(io::Error),
    SignalError(SendError<T>),
}
impl<T> Display for DownloadManagerError<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DownloadManagerError::IOError(error) => write!(f, "{error}"),
            DownloadManagerError::SignalError(send_error) => write!(f, "{send_error}"),
        }
    }
}
impl<T> From<SendError<T>> for DownloadManagerError<T> {
    fn from(value: SendError<T>) -> Self {
        DownloadManagerError::SignalError(value)
    }
}
impl<T> From<io::Error> for DownloadManagerError<T> {
    fn from(value: io::Error) -> Self {
        DownloadManagerError::IOError(value)
    }
}

// PENDING: Rename / separate from downloads
#[derive(Debug, SerializeDisplay)]
pub enum ApplicationDownloadError {
    NotInitialized,
    Communication(RemoteAccessError),
    DiskFull(u64, u64),
    #[allow(dead_code)]
    Checksum,
    Lock,
    IoError(Arc<io::Error>),
    DownloadError(RemoteAccessError),
    InvalidCommand,
}

impl Display for ApplicationDownloadError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            ApplicationDownloadError::NotInitialized => {
                write!(f, "Download not initalized, did something go wrong?")
            }
            ApplicationDownloadError::DiskFull(required, available) => write!(
                f,
                "Game requires {}, {} remaining left on disk.",
                format_size(*required, BINARY),
                format_size(*available, BINARY),
            ),
            ApplicationDownloadError::Communication(error) => write!(f, "{error}"),
            ApplicationDownloadError::Lock => write!(
                f,
                "failed to acquire lock. Something has gone very wrong internally. Please restart the application"
            ),
            ApplicationDownloadError::Checksum => {
                write!(f, "checksum failed to validate for download")
            }
            ApplicationDownloadError::IoError(error) => write!(f, "io error: {error}"),
            ApplicationDownloadError::DownloadError(error) => {
                write!(f, "Download failed with error {error:?}")
            }
            ApplicationDownloadError::InvalidCommand => write!(f, "Invalid command state"),
        }
    }
}

impl From<io::Error> for ApplicationDownloadError {
    fn from(value: io::Error) -> Self {
        ApplicationDownloadError::IoError(Arc::new(value))
    }
}

impl From<RemoteAccessError> for ApplicationDownloadError {
    fn from(value: RemoteAccessError) -> Self {
        ApplicationDownloadError::Communication(value)
    }
}

impl From<StripPrefixError> for ApplicationDownloadError {
    fn from(value: StripPrefixError) -> Self {
        ApplicationDownloadError::IoError(Arc::new(io::Error::other(value)))
    }
}
