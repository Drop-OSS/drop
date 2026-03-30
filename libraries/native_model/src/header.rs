use zerocopy::little_endian::U32;
use zerocopy::{FromBytes, Immutable, IntoBytes, KnownLayout};

#[derive(FromBytes, IntoBytes, Immutable, KnownLayout, Debug)]
#[repr(C)]
pub struct Header {
    pub(crate) id: U32,
    pub(crate) version: U32,
}
