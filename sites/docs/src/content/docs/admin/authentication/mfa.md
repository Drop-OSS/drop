---
title: Multi-factor
description: Notes about the various MFA/2FA method available in Drop.
---

## WebAuthn (a.k.a Passkeys)
Passkeys are a passwordless authentication standard backed by both HSMs and software like password managers.

Drop supports them both as a MFA method, and a single-step signin. 

Passkeys are expected to work out-of-the-box on all installs, but you may have issues if you don't run Drop over HTTPS. 

Additionally, if you're having issues related to the domain/relying party (RP) reported to WebAuthn, you can set the `WEBAUTHN_DOMAIN` to override that. WebAuthn requires all relying parties to either be a domain (example.com) or a subdomain (example.com)

## TOTP or code-based
TOTP is expected to work out of the box. 