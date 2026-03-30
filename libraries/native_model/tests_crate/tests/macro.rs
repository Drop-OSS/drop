#![cfg(feature = "bincode_1_3")]

use serde::{Deserialize, Serialize};
use native_model::{native_model, Model};

#[derive(Debug, Serialize, Deserialize)]
#[native_model(id = 1, version =  1)]
struct Foo1 {
    x: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[native_model(id = 1, version = 2, from = Foo1)]
struct Foo2 {
    x: i32,
}

impl From<Foo1> for Foo2 {
    fn from(foo1: Foo1) -> Self {
        Foo2 { x: foo1.x }
    }
}

impl From<Foo2> for Foo1 {
    fn from(foo2: Foo2) -> Self {
        Foo1 { x: foo2.x }
    }
}

#[test]
fn get_id_version_int() {
    assert_eq!(Foo1::native_model_id(), 1);
    assert_eq!(Foo1::native_model_version(), 1);

    assert_eq!(Foo2::native_model_id(), 1);
    assert_eq!(Foo2::native_model_version(), 2);
}

#[test]
fn get_id_version_str() {
    assert_eq!(Foo1::native_model_id_str(), "1");
    assert_eq!(Foo1::native_model_version_str(), "1");

    assert_eq!(Foo2::native_model_id_str(), "1");
    assert_eq!(Foo2::native_model_version_str(), "2");
}
