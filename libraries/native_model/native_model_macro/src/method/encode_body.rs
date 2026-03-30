use crate::ModelAttributes;
use proc_macro2::TokenStream;
use quote::quote;

pub(crate) fn generate_native_model_encode_body(attrs: &ModelAttributes) -> TokenStream {
    let with = attrs.with.clone().expect("`with` is required");
    let gen = quote! {
        fn native_model_encode_body(&self) -> std::result::Result<Vec<u8>, native_model::EncodeBodyError> {
            use native_model::Encode;
            #with::encode(self).map_err(|e| native_model::EncodeBodyError {
                msg: format!("{}", e),
                source: e.into(),
            })
        }
    };

    gen
}
