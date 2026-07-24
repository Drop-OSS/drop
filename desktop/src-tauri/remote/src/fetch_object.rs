use database::DB;
use http::{Response, header::CONTENT_TYPE, response::Builder as ResponseBuilder};
use log::{debug, warn};
use tauri::UriSchemeResponder;

use crate::{error::CacheError, utils::DROP_CLIENT_ASYNC};

use super::{
    auth::generate_authorization_header,
    cache::{ObjectCache, cache_object, get_cached_object},
};

pub async fn fetch_object_wrapper(request: http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    match fetch_object(request).await {
        Ok(r) => responder.respond(r),
        Err(e) => {
            warn!("Cache error: {e}");
            responder.respond(
                Response::builder()
                    .status(500)
                    .body(Vec::new())
                    .expect("Failed to build error response"),
            );
        }
    };
}

pub async fn fetch_object(
    request: http::Request<Vec<u8>>,
) -> Result<Response<Vec<u8>>, CacheError> {
    // Drop leading /
    let object_id = &request.uri().path()[1..];

    let cache_result = get_cached_object::<ObjectCache>(object_id);
    if let Ok(cache_result) = &cache_result
        && !cache_result.has_expired()
    {
        return cache_result.try_into();
    }

    let header = generate_authorization_header();
    let client = DROP_CLIENT_ASYNC.clone();
    let url = format!("{}api/v1/client/object/{object_id}", DB.fetch_base_url());
    let response = client.get(url).header("Authorization", header).send().await;

    match response {
        Ok(r) => {
            let resp_builder = ResponseBuilder::new().header(
                CONTENT_TYPE,
                r.headers()
                    .get("Content-Type")
                    .expect("Failed get Content-Type header"),
            );
            let data = match r.bytes().await {
                Ok(data) => Vec::from(data),
                Err(e) => {
                    warn!("Could not get data from cache object {object_id} with error {e}",);
                    Vec::new()
                }
            };
            let resp = resp_builder
                .body(data)
                .expect("Failed to build object cache response body");
            if cache_result.map_or(true, |x| x.has_expired()) {
                cache_object::<ObjectCache>(object_id, &resp.clone().try_into()?)
                    .expect("Failed to create cached object");
            }

            Ok(resp)
        }
        Err(e) => {
            debug!("Object fetch failed with error {e}. Attempting to download from cache");
            match cache_result {
                Ok(cache_result) => cache_result.try_into(),
                Err(e) => {
                    warn!("{e}");
                    Err(CacheError::Remote(e))
                }
            }
        }
    }
}
