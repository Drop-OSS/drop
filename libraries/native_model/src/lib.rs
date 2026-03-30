//! `native_model` is a Rust crate that acts as a thin wrapper around serialized data, adding identity and version information.
//!
//! - It aims to ensure:
//!   - **Interoperability**: Different applications can work together even if they use different data model versions.
//!   - **Data Consistency**: Ensures the data is processed as expected.
//!   - **Flexibility**: Allows the use of any serialization format. Mode details [here](https://github.com/Drop-OSS/native_model#setup-your-serialization-format).
//!   - **Minimal Performance Overhead**: Current performance has a minimal overhead see [performance](https://github.com/Drop-OSS/native_model#performance) section.
//! - **Suitability**:
//!   - Suitable for applications that are written in Rust, evolve independently, store data locally, and require incremental upgrades.
//!   - Not suitable for non-Rust applications, systems not controlled by the user, or when human-readable formats are needed.
//! - **Setup**:
//!   - Users must define their own serialization format and data model. Mode details [here](https://github.com/Drop-OSS/native_model#setup-your-serialization-format).
//! - **Development Stage**:
//!   - The crate is in early development, and performance is expected to improve over time.
//!
//! See examples in the [README.md](https://github.com/Drop-OSS/native_model) file.

#[cfg(doctest)]
#[macro_use]
extern crate doc_comment;

#[cfg(doctest)]
doc_comment! {
    include_str!("../README.md")
}

#[cfg(any(
    feature = "serde",
    feature = "bincode_1_3",
    feature = "bincode_2",
    feature = "postcard_1_0",
    feature = "rmp_serde_1_3",
    doc
))]
mod codec;

#[cfg(any(
    feature = "serde",
    feature = "bincode_1_3",
    feature = "bincode_2",
    feature = "postcard_1_0",
    feature = "rmp_serde_1_3",
    doc
))]
pub use codec::*;
mod header;
pub mod wrapper;

// Macro to generate a [`native_model`] implementation for a struct.
pub use native_model_macro::*;

use wrapper::*;

use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Invalid header")]
    InvalidHeader,
    #[error("Failed to decode native model")]
    DecodeError,
    #[error(transparent)]
    DecodeBodyError(#[from] DecodeBodyError),
    #[error(transparent)]
    EncodeBodyError(#[from] EncodeBodyError),
    #[error(transparent)]
    UpgradeError(#[from] UpgradeError),
    #[error("Upgrade from {} to {} is not supported", from, to)]
    UpgradeNotSupported { from: u32, to: u32 },
    #[error(transparent)]
    DowngradeError(#[from] DowngradeError),
    #[error("Downgrade from {} to {} is not supported", from, to)]
    DowngradeNotSupported { from: u32, to: u32 },
    #[error("Wrong type id expected: {}, actual: {}", expected, actual)]
    WrongTypeId { expected: u32, actual: u32 },
}

pub type DecodeResult<T> = std::result::Result<T, DecodeBodyError>;

#[derive(Error, Debug)]
#[error("Decode body error: {msg}")]
pub enum DecodeBodyError {
    #[error("Mismatched model id")]
    MismatchedModelId,
    #[error("Decode error: {msg}")]
    DecodeError {
        msg: String,
        #[source]
        source: anyhow::Error,
    },
}

pub type EncodeResult<T> = std::result::Result<T, EncodeBodyError>;

#[derive(Error, Debug)]
#[error("Encode body error: {msg}")]
pub struct EncodeBodyError {
    pub msg: String,
    #[source]
    pub source: anyhow::Error,
}

#[derive(Error, Debug)]
#[error("Upgrade error: {msg}")]
pub struct UpgradeError {
    pub msg: String,
    #[source]
    pub source: anyhow::Error,
}

#[derive(Error, Debug)]
#[error("Downgrade error: {msg}")]
pub struct DowngradeError {
    pub msg: String,
    #[source]
    pub source: anyhow::Error,
}

/// Allows to encode a [`native_model`] into a [`Vec<u8>`].
///
/// See examples:
///    - [README.md](https://github.com/Drop-OSS/native_model) file.
///    - other [examples](https://github.com/Drop-OSS/native_model/tree/master/tests/example)
///
/// # Errors
///
/// The errors returned from this function depend on the [`Encode`] trait
/// implementor (the serializer), i.e. `bincode_2`.
pub fn encode<T: crate::Model>(model: &T) -> Result<Vec<u8>> {
    T::native_model_encode(model)
}

/// Allows to decode a [`native_model`] from a [`Vec<u8>`] and returns the version ([`u32`]).
/// See examples:
///    - [README.md](https://github.com/Drop-OSS/native_model) file.
///    - other [examples](https://github.com/Drop-OSS/native_model/tree/master/tests/example)
///
/// # Errors
///
/// The errors returned from this function depend on the [`Decode`] trait
/// implementor (the deserializer), i.e. `bincode_2`.
pub fn decode<T: crate::Model>(data: Vec<u8>) -> Result<(T, u32)> {
    T::native_model_decode(data)
}

pub trait Model: Sized {
    fn native_model_id() -> u32;
    fn native_model_id_str() -> &'static str;
    fn native_model_version() -> u32;
    fn native_model_version_str() -> &'static str;

    // --------------- Decode ---------------
    fn native_model_decode_body(data: Vec<u8>, id: u32) -> DecodeResult<Self>;

    fn native_model_decode_upgrade_body(data: Vec<u8>, id: u32, version: u32) -> Result<Self>;

    fn native_model_decode(data: impl AsRef<[u8]>) -> Result<(Self, u32)> {
        let native_model = crate::Wrapper::deserialize(data.as_ref()).unwrap();
        let source_id = native_model.get_id();
        let source_version = native_model.get_version();
        let result = Self::native_model_decode_upgrade_body(
            native_model.value().to_vec(),
            source_id,
            source_version,
        )?;
        Ok((result, source_version))
    }

    // --------------- Encode ---------------

    fn native_model_encode_body(&self) -> EncodeResult<Vec<u8>>;

    fn native_model_encode(&self) -> Result<Vec<u8>> {
        let mut data = self.native_model_encode_body()?;
        let data = crate::native_model_encode(
            &mut data,
            Self::native_model_id(),
            Self::native_model_version(),
        );
        Ok(data)
    }
}
