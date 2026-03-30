#![cfg(feature = "bincode_1_3")]

use native_model::native_model;
use native_model::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[native_model(id = 1, version = 1)]
struct Foo1 {
    x: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
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
fn test_simple() {
    let foo1 = Foo1 { x: 100 };
    let foo2 = Foo2 { x: 200 };
    let foo1_encoded = foo1.native_model_encode().unwrap();
    let foo2_encoded = foo2.native_model_encode().unwrap();

    let (foo1_decoded, _) = Foo1::native_model_decode(foo1_encoded).unwrap();
    assert!(foo1_decoded == foo1);
    let (foo2_decoded, _) = Foo2::native_model_decode(foo2_encoded).unwrap();
    assert!(foo2_decoded == foo2);
}
