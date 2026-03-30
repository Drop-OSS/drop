use log::error;
use reqwest::StatusCode;

#[derive(Debug)]
pub struct ErrorOption(Result<StatusCode, anyhow::Error>);
impl From<anyhow::Error> for ErrorOption {
    fn from(value: anyhow::Error) -> Self {
        Self(Err(value))
    }
}
impl From<reqwest::Error> for ErrorOption {
    fn from(value: reqwest::Error) -> Self {
        Self(Err(value.into()))
    }
}
impl From<url::ParseError> for ErrorOption {
    fn from(value: url::ParseError) -> Self {
        Self(Err(value.into()))
    }
}
impl From<StatusCode> for ErrorOption {
    fn from(value: StatusCode) -> Self {
        Self(Ok(value))
    }
}

impl From<ErrorOption> for StatusCode {
    fn from(value: ErrorOption) -> Self {
        match value.0 {
            Ok(status) => status,
            Err(err) => {
                error!("{err:?}");
                Self::INTERNAL_SERVER_ERROR
            }
        }
    }
}
