use crate::ModelAttributes;
use proc_macro2::TokenStream;
use quote::quote;

pub(crate) fn generate_native_model_version(model_attributes: &ModelAttributes) -> TokenStream {
    let native_model_version = model_attributes.version.clone().unwrap();
    let gen = quote! {
        fn native_model_version() -> u32 {
            #native_model_version
        }

        fn native_model_version_str() -> &'static str {
            stringify!(#native_model_version)
        }
    };
    gen
}
