//! [bincode 2.0](https://crates.io/crates/bincode/2.0.1) ·
//! Enable the `bincode_2` feature and annotate your type with
//! `native_model::bincode_2::Bincode` to have `native_db` use this crate for
//! serializing & deserializing.

/// Used to specify the
/// [bincode 2.0](https://crates.io/crates/bincode/2.0.1)
/// crate for serialization & deserialization.
///
/// # Warning
///
/// `bincode` [does not implement](https://docs.rs/bincode/2.0.1/bincode/serde/index.html#known-issues)
/// all [serde](https://crates.io/crates/serde) features. Errors may be
/// encountered when using this with some types.
///
/// If you are encountering errors when using this codec on your types, try
/// using the `rmp_serde_1_3` codec instead.
///
/// # Basic usage
///
/// After enabling the `bincode_2` feature in your `Cargo.toml`, use the
/// [`with`](crate::native_model) attribute on your type to instruct
/// `native_model` to use `Bincode` for serialization & deserialization.
///
/// Example usage:
///
/// ```rust
/// # use native_model::*;
/// #[derive(Clone, Default, serde::Deserialize, serde::Serialize)]
/// #[native_model(id = 1, version = 1, with = native_model::bincode_2::Bincode)]
/// struct MyStruct {
///     my_string: String
/// }
/// ```

pub struct Bincode;

#[cfg(all(feature = "serde", feature = "bincode_2"))]
impl<T: serde::Serialize> super::Encode<T> for Bincode {
    type Error = bincode_2::error::EncodeError;
    /// Serializes a type into bytes using the `bincode` `2.0` crate.
    fn encode(obj: &T) -> Result<Vec<u8>, Self::Error> {
        bincode_2::serde::encode_to_vec(obj, bincode_2::config::standard())
    }
}

#[cfg(all(feature = "serde", feature = "bincode_2"))]
impl<T: for<'de> serde::Deserialize<'de>> super::Decode<T> for Bincode {
    type Error = bincode_2::error::DecodeError;
    /// Deserializes a type from bytes using the `bincode` `2.0` crate.
    fn decode(data: Vec<u8>) -> Result<T, Self::Error> {
        Ok(bincode_2::serde::decode_from_slice(&data, bincode_2::config::standard())?.0)
    }
}
