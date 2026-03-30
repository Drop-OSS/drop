extern crate proc_macro;
extern crate log;

mod method;

use crate::method::{
    generate_native_model_decode_body, generate_native_model_decode_upgrade_body,
    generate_native_model_encode_body,
    generate_native_model_id, generate_native_model_version,
};
use proc_macro::TokenStream;
use quote::quote;
use syn::meta::ParseNestedMeta;
use syn::parse::{Parse, Result};
use syn::punctuated::Punctuated;
use syn::token;
use syn::{parse_macro_input, DeriveInput, LitInt, Path, Token};

// Inspiration: https://docs.rs/syn/2.0.29/syn/meta/fn.parser.html#example-1
pub(crate) struct ModelAttributes {
    pub(crate) id: Option<LitInt>,
    pub(crate) version: Option<LitInt>,
    // type
    pub(crate) with: Option<Path>,
    // type
    pub(crate) from: Option<Path>,
    // (type, try_from::Error type)
    pub(crate) try_from: Option<(Path, Path)>,
}

impl Default for ModelAttributes {
    fn default() -> Self {
        ModelAttributes {
            id: None,
            version: None,
            with: Some(syn::parse_str::<Path>("native_model::bincode_1_3::Bincode").unwrap()),
            from: None,
            try_from: None,
        }
    }
}

impl ModelAttributes {
    fn parse(&mut self, meta: ParseNestedMeta) -> Result<()> {
        if meta.path.is_ident("id") {
            self.id = Some(meta.value()?.parse()?);
        } else if meta.path.is_ident("version") {
            self.version = Some(meta.value()?.parse()?);
        } else if meta.path.is_ident("with") {
            self.with = Some(meta.value()?.parse()?);
        } else if meta.path.is_ident("from") {
            self.from = Some(meta.value()?.parse()?);
        } else if meta.path.is_ident("try_from") {
            let tuple_try_from: TupleTryFrom = meta.value()?.parse()?;
            let mut fields = tuple_try_from.fields.into_iter();
            self.try_from.replace((
                fields.next().unwrap().clone(),
                fields.next().unwrap().clone(),
            ));
        } else {
            panic!("Unknown attribute: {}", meta.path.get_ident().unwrap());
        }
        Ok(())
    }
}

#[derive(Default)]
pub(crate) struct TupleTryFrom {
    pub(crate) _parent_token: token::Paren,
    pub(crate) fields: Punctuated<Path, Token![,]>,
}

impl Parse for TupleTryFrom {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let content;
        Ok(TupleTryFrom {
            _parent_token: syn::parenthesized!(content in input),
            fields: content.parse_terminated(Path::parse, Token![,])?,
        })
    }
}

/// Macro which add identity and version to your rust type.
///
/// Attributes:
/// - `id = u32`: The unique identifier of the model.
/// - `version = u32`: The version of the model.
/// - `with` = type: Required, the serialization/deserialization library that you use. Must implement `native_model::Encode` and `native_model::Decode`.
/// - `from = type`: Optional, the previous version of the model.
///     - `type`: The previous version of the model that you use for the From implementation.
/// - `try_from = (type, error)`: Optional, the previous version of the model with error handling.
///     - `type`: The previous version of the model that you use for the TryFrom implementation.
///     - `error`: The error type that you use for the TryFrom implementation.
///
/// See examples:
///    - [Setup your data model](https://github.com/vincent-herlemont/native_model_private#setup-your-data-model).
///    - other [examples](https://github.com/Drop-OSS/native_model/tree/master/tests/example)
#[proc_macro_attribute]
pub fn native_model(args: TokenStream, input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as DeriveInput);
    let struct_name = &ast.ident;

    let mut attrs = ModelAttributes::default();
    let model_attributes_parser = syn::meta::parser(|meta| attrs.parse(meta));
    parse_macro_input!(args with model_attributes_parser);

    let native_model_id_fn = generate_native_model_id(&attrs);
    let native_model_version_fn = generate_native_model_version(&attrs);
    let native_model_encode_body_fn = generate_native_model_encode_body(&attrs);
    let native_model_decode_body_fn = generate_native_model_decode_body(&attrs);
    let native_model_decode_upgrade_body_fn = generate_native_model_decode_upgrade_body(&attrs, struct_name);


    let gen = quote! {
        #ast

        impl native_model::Model for #struct_name {
            #native_model_id_fn
            #native_model_version_fn
            #native_model_encode_body_fn
            #native_model_decode_body_fn
            #native_model_decode_upgrade_body_fn
        }
    };

    gen.into()
}
