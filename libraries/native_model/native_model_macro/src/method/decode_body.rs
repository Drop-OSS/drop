use crate::ModelAttributes;
use proc_macro2::TokenStream;
use quote::quote;

pub(crate) fn generate_native_model_decode_body(attrs: &ModelAttributes) -> TokenStream {
    let id = attrs.id.clone().expect("`id` is required");
    let with = attrs.with.clone().expect("`with` is required");
    let gen = quote! {
        fn native_model_decode_body(data: Vec<u8>, id: u32) -> std::result::Result<Self, native_model::DecodeBodyError> {
            if id != #id {
                return Err(native_model::DecodeBodyError::MismatchedModelId);
            }

            use native_model::Decode;
            #with::decode(data).map_err(|e| native_model::DecodeBodyError::DecodeError {
                msg: format!("{}", e),
                source: e.into(),
            })
        }
    };

    gen
}
