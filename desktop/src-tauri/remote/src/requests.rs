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

pub async fn make_authenticated_get(url: Url) -> Result<reqwest::Response, Error> {
    DROP_CLIENT_ASYNC
        .get(url)
        .header("Authorization", generate_authorization_header())
        .send()
        .await
}
