//! Traits and implementations for encoding types into a series of bytes and
//! decoding bytes back into types.

#[cfg(any(all(feature = "serde", feature = "bincode_1_3"), doc))]
pub mod bincode_1_3;
#[cfg(any(all(feature = "serde", feature = "bincode_2"), doc))]
pub mod bincode_2;
#[cfg(any(all(feature = "serde", feature = "postcard_1_0"), doc))]
pub mod postcard_1_0;
#[cfg(any(all(feature = "serde", feature = "rmp_serde_1_3"), doc))]
pub mod rmp_serde_1_3;

/// Encode trait for your own encoding method.
///
/// Example:
/// ```rust
/// use bincode_2::{error::EncodeError,serde::encode_to_vec, config::standard};
/// use serde::Serialize;
/// pub struct Bincode;
///
/// impl<T: Serialize> native_model::Encode<T> for Bincode {
///     type Error = EncodeError;
///     fn encode(obj: &T) -> Result<Vec<u8>, EncodeError> {
///         Ok(encode_to_vec(&obj, standard())?)
///     }
/// }
/// ```
pub trait Encode<T> {
    type Error;
    /// Encodes a `T` type into a series of bytes.
    ///
    /// # Errors
    ///
    /// The errors returned from this function depend on the trait implementor
    /// (the serializer), i.e. `bincode_2`.
    fn encode(obj: &T) -> Result<Vec<u8>, Self::Error>;
}

/// Decode trait for your own decoding method.
///
/// Example:
/// ```rust
/// use bincode_2::{error::DecodeError,serde::decode_from_slice, config::standard};
/// use serde::Deserialize;
/// pub struct Bincode;
///
/// impl<T: for<'a> Deserialize<'a>> native_model::Decode<T> for Bincode {
///     type Error = DecodeError;
///     fn decode(data: Vec<u8>) -> Result<T, DecodeError> {
///         Ok(decode_from_slice(&data, standard())?.0)
///     }
/// }
pub trait Decode<T> {
    type Error;
    /// Decodes a series of bytes back into a `T` type.
    ///
    /// # Errors
    ///
    /// The errors returned from this function depend on the trait implementor
    /// (the deserializer), i.e. `bincode_2`.
    fn decode(data: Vec<u8>) -> Result<T, Self::Error>;
}
