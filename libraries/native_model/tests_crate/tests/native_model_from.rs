#![cfg(feature = "bincode_1_3")]

use native_model::native_model;
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
    c: char,
}

impl From<Foo1> for Foo2 {
    fn from(foo1: Foo1) -> Self {
        Foo2 { x: foo1.x, c: 'a' }
    }
}

impl From<Foo2> for Foo1 {
    fn from(foo2: Foo2) -> Self {
        Foo1 { x: foo2.x }
    }
}

impl PartialEq<Foo1> for Foo2 {
    fn eq(&self, other: &Foo1) -> bool {
        self.x == other.x
    }
}

#[test]
fn test_decode_foo1_to_foo1() {
    let foo1 = Foo1 { x: 100 };
    let foo1_packed = native_model::encode(&foo1).unwrap();
    let (foo1_decoded, _) = native_model::decode::<Foo1>(foo1_packed.clone()).unwrap();
    assert_eq!(foo1, foo1_decoded);
}

#[test]
fn test_decode_foo1_to_foo2() {
    let foo1 = Foo1 { x: 100 };
    let foo1_packed = native_model::encode(&foo1).unwrap();
    let (foo2_decoded, _) = native_model::decode::<Foo2>(foo1_packed.clone()).unwrap();
    assert_eq!(Foo2 { x: 100, c: 'a' }, foo2_decoded);
}

#[test]
fn test_encode_foo2_to_foo1() {
    let foo2 = Foo2 { x: 100, c: 'a' };
    let foo2_packed = native_model::encode(&foo2).unwrap();
    assert_eq!(foo2_packed, vec![1, 0, 0, 0, 2, 0, 0, 0, 100, 0, 0, 0, 97]);
    let (foo2_decoded, _) = native_model::decode::<Foo2>(foo2_packed.clone()).unwrap();
    assert_eq!(Foo2 { x: 100, c: 'a' }, foo2_decoded);
    let foo1_packed = native_model::encode_downgrade(foo2, 1).unwrap();
    assert_eq!(foo1_packed, vec![1, 0, 0, 0, 1, 0, 0, 0, 100, 0, 0, 0]);
    let (foo1_decoded, _) = native_model::decode::<Foo1>(foo1_packed.clone()).unwrap();
    assert_eq!(Foo1 { x: 100 }, foo1_decoded);
}

#[test]
fn test_encode_foo1_to_foo1() {
    let foo1 = Foo1 { x: 100 };
    let foo1_packed = native_model::encode(&foo1).unwrap();
    assert_eq!(foo1_packed, vec![1, 0, 0, 0, 1, 0, 0, 0, 100, 0, 0, 0]);
    let (foo1_decoded, _) = native_model::decode::<Foo1>(foo1_packed.clone()).unwrap();
    assert_eq!(Foo1 { x: 100 }, foo1_decoded);
    let foo1_packed = native_model::encode_downgrade(foo1, 1).unwrap();
    assert_eq!(foo1_packed, vec![1, 0, 0, 0, 1, 0, 0, 0, 100, 0, 0, 0]);
    let (foo1_decoded, _) = native_model::decode::<Foo1>(foo1_packed.clone()).unwrap();
    assert_eq!(Foo1 { x: 100 }, foo1_decoded);
}

#[test]
fn encode_decode_with_same_version() {
    // Client 1
    let foo1 = Foo1 { x: 100 };
    let foo_packed = native_model::encode(&foo1).unwrap();
    // Send foo_packed to server

    // Server
    let (mut foo2, version) = native_model::decode::<Foo2>(foo_packed.clone()).unwrap();
    // Do something with foo2
    foo2.x += 1;
    let foo_packed = native_model::encode_downgrade(foo2, version).unwrap();
    // Send foo_packed back to client

    // Client
    let (foo1_decoded, _) = native_model::decode::<Foo1>(foo_packed.clone()).unwrap();
    assert_eq!(Foo1 { x: 101 }, foo1_decoded);
}
