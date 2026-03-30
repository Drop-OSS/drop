use bincode;
use serde::{Deserialize, Serialize};

pub struct Bincode;

impl<T: Serialize> native_model::Encode<T> for Bincode {
    type Error = bincode::error::EncodeError;
    fn encode(obj: &T) -> Result<Vec<u8>, bincode::error::EncodeError> {
        bincode::serde::encode_to_vec(obj, bincode::config::standard())
    }
}

impl<T: for<'a> Deserialize<'a>> native_model::Decode<T> for Bincode {
    type Error = bincode::error::DecodeError;
    fn decode(data: Vec<u8>) -> Result<T, bincode::error::DecodeError> {
        Ok(bincode::serde::decode_from_slice(&data, bincode::config::standard())?.0)
    }
}

use native_model::native_model;

#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[native_model(id = 1, version = 1, with = Bincode)]
struct DotV1(u32, u32);

#[test]
fn test_bincode_serde_serialize_deserialize() {
    // Application 1
    let dot = DotV1(1, 2);
    let bytes = native_model::encode(&dot).unwrap();
    // Application 1
    let (dot, _) = native_model::decode::<DotV1>(bytes).unwrap();
    assert_eq!(dot, DotV1(1, 2));
}
