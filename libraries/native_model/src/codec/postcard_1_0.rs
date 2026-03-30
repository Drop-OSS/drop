//! [postcard 1.0](https://crates.io/crates/postcard/1.0.8) ·
//! Enable the `postcard_1_0` feature and annotate your type with
//! `native_model::postcard_1_0::PostCard` to have `native_db` use this crate.

/// Used to specify the [postcard 1.0](https://crates.io/crates/postcard/1.0.8)
/// crate for serialization & deserialization.
///
/// # Warning
///
/// `postcard` does not implement all [serde](https://crates.io/crates/serde)
/// features. Errors may be encountered when using this with some types.
///
/// If you are encountering errors when using this codec on your types, try
/// using the `rmp_serde_1_3` codec instead.
///
/// # Basic usage
///
/// After enabling the `postcard_1_0` feature in your `Cargo.toml`, use the
/// [`with`](crate::native_model) attribute on your type to instruct
/// `native_model` to use `PostCard` for serialization & deserialization.
///
/// Example usage:
///
/// ```rust
/// # use native_model::*;
/// #[derive(Clone, Default, serde::Deserialize, serde::Serialize)]
/// #[native_model(id = 1, version = 1, with = native_model::postcard_1_0::PostCard)]
/// struct MyStruct {
///     my_string: String
/// }
/// ```

pub struct PostCard;

#[cfg(all(feature = "serde", feature = "postcard_1_0"))]
impl<T: serde::Serialize> super::Encode<T> for PostCard {
    type Error = postcard_1_0::Error;
    /// Serializes a type into bytes using the `postcard` `1.0` crate.
    fn encode(obj: &T) -> Result<Vec<u8>, Self::Error> {
        postcard_1_0::to_allocvec(obj)
    }
}

#[cfg(all(feature = "serde", feature = "postcard_1_0"))]
impl<T: for<'de> serde::Deserialize<'de>> super::Decode<T> for PostCard {
    type Error = postcard_1_0::Error;
    /// Deserializes a type from bytes using the `postcard` `1.0` crate.
    fn decode(data: Vec<u8>) -> Result<T, Self::Error> {
        postcard_1_0::from_bytes(&data)
    }
}
