use std::fmt;

/// Everything that can go wrong on the device side of a save sync.
///
/// `Conflict` is not a failure: it is the always-ask policy asking the caller
/// to surface a choice, carrying the server head that moved underneath us.
#[derive(Debug)]
pub enum SaveError {
    Io(std::io::Error),
    Json(serde_json::Error),
    /// Non-success HTTP from the server, with whatever message it sent.
    Http {
        status: u16,
        message: String,
    },
    /// A download or extraction did not match its declared hashes/sizes.
    Corrupt(String),
    /// A manifest entry could not be understood well enough to trust it.
    Manifest(String),
    /// A resolved path escaped somewhere it must not (absolute, `..`, ...).
    Path(String),
}

impl fmt::Display for SaveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SaveError::Io(e) => write!(f, "io error: {e}"),
            SaveError::Json(e) => write!(f, "json error: {e}"),
            SaveError::Http { status, message } => {
                write!(f, "server answered {status}: {message}")
            }
            SaveError::Corrupt(what) => write!(f, "corrupt save data: {what}"),
            SaveError::Manifest(what) => write!(f, "bad save manifest: {what}"),
            SaveError::Path(what) => write!(f, "unsafe save path: {what}"),
        }
    }
}

impl std::error::Error for SaveError {}

impl From<std::io::Error> for SaveError {
    fn from(e: std::io::Error) -> Self {
        SaveError::Io(e)
    }
}

impl From<serde_json::Error> for SaveError {
    fn from(e: serde_json::Error) -> Self {
        SaveError::Json(e)
    }
}

/// Transport trouble (connection reset, timeout, body read failure): there
/// is no HTTP answer at all, which is why it is not `Http`.
impl From<reqwest::Error> for SaveError {
    fn from(e: reqwest::Error) -> Self {
        SaveError::Io(std::io::Error::other(e))
    }
}
