use crate::ModelAttributes;
use proc_macro2::TokenStream;
use quote::quote;

pub(crate) fn generate_native_model_id(model_attributes: &ModelAttributes) -> TokenStream {
    let native_model_id = model_attributes.id.clone().unwrap();
    let gen = quote! {
        fn native_model_id() -> u32 {
            #native_model_id
        }

        fn native_model_id_str() -> &'static str {
            stringify!(#native_model_id)
        }
    };
    gen
}
