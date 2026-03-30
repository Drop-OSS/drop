#![cfg(feature = "bincode_1_3")]
use native_model::native_model;
use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[native_model(id = 1, version = 1, with = native_model::bincode_1_3::Bincode)]
struct Example {
    a: u32,
    b: u32,
}

#[test]
fn encode_decode() {
    let example = Example { a: 1, b: 2 };
    let bytes = native_model::encode(&example).unwrap();
    let (example, _) = native_model::decode::<Example>(bytes).unwrap();
    assert_eq!(example, Example { a: 1, b: 2 });
}
