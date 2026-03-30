# Protocol

`torrential` implements the Depot API as defined by https://developer.droposs.org/web/depot, and it prefixed with `/api/v1/depot` for NGINX proxying.

It also has the following endpoints, only accessible by the Drop server for security reasons:
 - `/key` for sharing the authentication key from the Drop server to torrential
 - `/invalidate` for pre-emptivel clearing the download context cache. Contexts are automatically cleared regardless, so this endpoint failing is not a hard error on the Drop side
 - `/healthcheck`. Does healthcheck.