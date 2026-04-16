---
title: OpenID Connect
---

OpenID Connect is a OAuth2 extension support by most identity providers.

## Configure OpenID Connect

To configure OIDC, you must set the following environment variables:

| Variable                             | Description                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `OIDC_CLIENT_ID`                     | Client ID from your identity provider.                                                                                                 |
| `OIDC_CLIENT_SECRET`                 | Client secret from your identity provider.                                                                                             |
| `OIDC_ADMIN_GROUP`                   | Grant admin to users with this group configured in your identity provider. Tested with Authentik.                                      |
| `OIDC_USER_GROUP` (optional)         | Optionally require a OIDC group to sign in. By default, Drop will allow any user.                                                      |
| `DISABLE_SIMPLE_AUTH` (optional)     | Disable simple auth                                                                                                                    |
| `OIDC_USERNAME_CLAIM` (optional)     | Change the field that Drop pulls the username claim from. Users are merged based on their usernames. Defaults to "preferred_username". |
| `OIDC_PROVIDER_NAME` (optional)      | Change the name of the OIDC provider that is displayed on the sign-in page. Default is "external provider".                            |
| `OIDC_DONT_REQUIRE_HTTPS` (optional) | Flag to disable HTTPS requirement for OIDC providers.                                                                                  |

---

And then, you must configure **either**:

#### Use `OIDC_WELLKNOWN`

A unprotected endpoint that returns a OIDC well-known JSON. Fetched on startup.

For example if you used authentik, your OIDC well-known endpoint would be: `https://authentik.tld/application/o/<slug>/.well-known/openid-configuration`.

---

#### Provide options individually

:::caution
Drop recommends using the OIDC well-known option **instead** of manually specifying each endpoint. This should only be used if your OIDC provider does not support the well-known format.
:::

| Variable             | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `OIDC_AUTHORIZATION` | Authorization endpoint. Usually ends with `authorize`.                    |
| `OIDC_TOKEN`         | Token endpoint. Usually ends with `token`.                                |
| `OIDC_USERINFO`      | Userinfo endpoint. Usually ends with `userinfo`.                          |
| `OIDC_SCOPES`        | Comma separated list of scopes. Requires, at least, `openid` and `email`. |
| `OIDC_ISSUER`        | OIDC issuer URL. Usually provided by the OIDC provider.                   |
| `OIDC_JWKS`          | OIDC JWKS validation URL.                                                 |

## Redirect URL

Drop uses the `EXTERNAL_URL` environment variable to create the callback URL: `$EXTERNAL_URL/api/v1/auth/odic/callback`.

For example: if `EXTERNAL_URL` was set to `http://localhost:3000/`, then the redirect URL would be `http://localhost:3000/api/v1/auth/odic/callback`.

## Logout URL

Drop supports OIDC back-channel logout, enabling the OIDC provider to logout users. Using the example above, the back-channel logout URL would be `http://localhost:3000/api/v1/auth/odic/logout`.
