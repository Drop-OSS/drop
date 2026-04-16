---
title: Exposing your instance
---

Exposing your instance allows it to be accessible from other computers than the one you're hosting it on.

## Setting `EXTERNAL_URL`

Drop uses `EXTERNAL_URL` for creating invitation links, OIDC redirects, and everything else. It should be passed as an environment variable, and include the protocol, ip/domain, and port (if applicable). Examples include:

- `http://192.168.0.100:3000`
- `https://drop.my.domain/`
- `http://drop.home.arpa:3000`

Drop automatically parses and formats the URL, so there are no requirements on the format, as long as it is a valid URL.

## LAN

The `compose.yaml` provided in the [Quickstart guide](/admin/quickstart/) already exposes the Drop instance on port 3000. If you're on the same LAN as your Drop instance, you can find it's IP and then use:

```
http://[instance IP]:3000
```

as the connection URL when setting up your Drop client.

## Reverse Proxy

If you are unsure how to set up a reverse proxy, or even what one is, this guide isn't for you. There are far better guides out there, so follow them to set up your reverse proxy.

There is no special configuration required to run Drop behind a reverse proxy.

## VPN

If you are unsure how to set up a VPN for remote access, please find and follow a far better guide than this one.

Accessing Drop over a VPN works very similarly to [accessing via LAN](#lan), so follow those steps.
