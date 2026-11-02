use database::DB;
use reqwest_middleware::Error;
use url::Url;

use crate::{
    auth::generate_authorization_header, error::RemoteAccessError, utils::DROP_CLIENT_ASYNC,
};

pub fn generate_url(
    path_components: &[&str],
    query: &[(&str, &str)],
) -> Result<Url, RemoteAccessError> {
    let path_appended = path_components.join("/");
    let mut base_url = DB.fetch_base_url().join(&path_appended)?;
    {
        let mut queries = base_url.query_pairs_mut();
        for (param, val) in query {
            queries.append_pair(param.as_ref(), val.as_ref());
        }
    }
    Ok(base_url)
}

/// The profile this device plays as, in header form. `None` omits the
/// selector, which the server reads as "the account's default profile" -
/// the same thing it read before profiles existed.
pub fn profile_header() -> Option<String> {
    DB.fetch_current_profile_id()
}

pub async fn make_authenticated_get(url: Url) -> Result<reqwest::Response, Error> {
    let mut request = DROP_CLIENT_ASYNC
        .get(url)
        .header("Authorization", generate_authorization_header());
    if let Some(profile) = profile_header() {
        request = request.header("x-profile-id", profile);
    }
    request.send().await
}

pub async fn make_authenticated_post<T: serde::Serialize>(
    url: Url,
    body: &T,
) -> Result<reqwest::Response, Error> {
    let mut request = DROP_CLIENT_ASYNC
        .post(url)
        .header("Authorization", generate_authorization_header())
        .json(body);
    if let Some(profile) = profile_header() {
        request = request.header("x-profile-id", profile);
    }
    request.send().await
}

pub async fn make_authenticated_patch<T: serde::Serialize>(
    url: Url,
    body: &T,
) -> Result<reqwest::Response, Error> {
    let mut request = DROP_CLIENT_ASYNC
        .patch(url)
        .header("Authorization", generate_authorization_header())
        .json(body);
    if let Some(profile) = profile_header() {
        request = request.header("x-profile-id", profile);
    }
    request.send().await
}
