import { randomUUID } from "crypto";
import prisma from "../../db/database";
import type { UserModel } from "~/prisma/client/models";
import { AuthMec } from "~/prisma/client/enums";
import objectHandler from "../../objects";
import type { Readable } from "stream";
import * as jdenticon from "jdenticon";
import { systemConfig } from "../../config/sys-conf";
import { logger } from "~/server/internal/logging";
import { type } from "arktype";
import * as jose from "jose";

// TODO: monitor https://github.com/goauthentik/authentik/issues/8751 for easier?? OIDC setup by end users

interface OIDCWellKnown {
  issuer: URL;
  authorization_endpoint: URL;
  token_endpoint: URL;
  userinfo_endpoint: URL;
  jwks_uri: URL;
  scopes_supported: string[];
}

interface OIDCAuthSessionOptions {
  redirect: string | undefined;
}

interface OIDCAuthSession {
  redirectUrl: string;
  callbackUrl: string;
  state: string;
  options: OIDCAuthSessionOptions;
}

interface OIDCUserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  groups?: Array<string>;
}

/**
 * @see https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
 * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
 */
const OIDCTokenResponseV1 = type({
  access_token: "string",
  token_type: "string",
  expires_in: "number?",
  refresh_token: "string?",
  scope: "string?",
  id_token: "string",
});

/**
 * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
 */
const OIDCIDTokenV1 = type({
  iss: "string",
  sub: "string",
  aud: "string | string[]",
  exp: "number",
  iat: "number",

  auth_time: "number?",
  nonce: "string?",
  acr: "string?",
  amr: "string[]?",
  azp: "string?",

  // see: https://openid.net/specs/openid-connect-backchannel-1_0.html#BCSupport
  // and: https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout
  sid: "string?", // session ID
});

export interface OIDCAuthMekCredentialsV1 {
  // only optional for compatibility with older versions
  iss?: string;
  sub: string;
}

export class OIDCManager {
  private oidcConfiguration: OIDCWellKnown;
  private clientId: string;
  private clientSecret: string;
  private externalUrl: string;

  private userGroup?: string = process.env.OIDC_USER_GROUP;
  private adminGroup?: string = process.env.OIDC_ADMIN_GROUP;
  private usernameClaim: keyof OIDCUserInfo =
    (process.env.OIDC_USERNAME_CLAIM as keyof OIDCUserInfo) ??
    "preferred_username";

  private signinStateTable: { [key: string]: OIDCAuthSession } = {};

  /**
   * Util to fetch JWKS for verifying tokens
   * @see https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md
   */
  private JWKS: ReturnType<typeof jose.createRemoteJWKSet>;

  constructor(
    oidcConfiguration: OIDCWellKnown,
    clientId: string,
    clientSecret: string,
    externalUrl: string,
  ) {
    this.oidcConfiguration = oidcConfiguration;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.externalUrl = externalUrl;

    this.JWKS = jose.createRemoteJWKSet(this.oidcConfiguration.jwks_uri);
  }

  static async create() {
    const wellKnownUrl = process.env.OIDC_WELLKNOWN as string | undefined;
    const scopes = process.env.OIDC_SCOPES as string | undefined;
    let configuration: OIDCWellKnown;
    if (wellKnownUrl) {
      const response: OIDCWellKnown = await $fetch<OIDCWellKnown>(wellKnownUrl);
      if (
        !response.authorization_endpoint ||
        !response.scopes_supported ||
        !response.token_endpoint ||
        !response.userinfo_endpoint ||
        !response.issuer ||
        !response.jwks_uri
      ) {
        throw new Error("Well known response was invalid");
      }
      if (scopes) {
        response.scopes_supported = scopes.split(",");
      }

      configuration = response;
    } else {
      const authorizationEndpoint = process.env.OIDC_AUTHORIZATION as
        | string
        | undefined;
      const tokenEndpoint = process.env.OIDC_TOKEN as string | undefined;
      const userinfoEndpoint = process.env.OIDC_USERINFO as string | undefined;
      const issuer = process.env.OIDC_ISSUER as string | undefined;
      const jwksEndpoint = process.env.OIDC_JWKS as string | undefined;

      if (
        !authorizationEndpoint ||
        !tokenEndpoint ||
        !userinfoEndpoint ||
        !scopes ||
        !issuer ||
        !jwksEndpoint
      ) {
        const debugObject = {
          OIDC_AUTHORIZATION: authorizationEndpoint,
          OIDC_TOKEN: tokenEndpoint,
          OIDC_USERINFO: userinfoEndpoint,
          OIDC_SCOPES: scopes,
          OIDC_ISSUER: issuer,
          OIDC_JWKS: jwksEndpoint,
        };
        throw new Error(
          "Missing all necessary OIDC configuration: \n" +
            Object.entries(debugObject)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join("\n"),
        );
      }

      configuration = {
        authorization_endpoint: new URL(authorizationEndpoint),
        token_endpoint: new URL(tokenEndpoint),
        userinfo_endpoint: new URL(userinfoEndpoint),
        scopes_supported: scopes.split(","),
        issuer: new URL(issuer),
        jwks_uri: new URL(jwksEndpoint),
      };
    }

    if (!configuration)
      throw new Error("OIDC try to init without configuration");

    const clientId = process.env.OIDC_CLIENT_ID as string | undefined;
    const clientSecret = process.env.OIDC_CLIENT_SECRET as string | undefined;
    const externalUrl = systemConfig.getExternalUrl();

    if (!clientId || !clientSecret)
      throw new Error("Missing client ID or secret for OIDC");

    if (!externalUrl) throw new Error("EXTERNAL_URL required for OIDC");

    return new OIDCManager(configuration, clientId, clientSecret, externalUrl);
  }

  generateConfiguration() {
    return {
      authorizationUrl: this.oidcConfiguration.authorization_endpoint,
      scopes: this.oidcConfiguration.scopes_supported.join(", "),
      adminGroup: this.adminGroup,
      usernameClaim: this.usernameClaim,
      externalUrl: this.externalUrl,
    };
  }

  generateAuthSession(options?: OIDCAuthSessionOptions): OIDCAuthSession {
    const stateKey = randomUUID();

    const normalisedUrl = new URL(
      this.oidcConfiguration.authorization_endpoint,
    ).toString();
    const redirectNormalisedUrl = new URL(this.externalUrl).toString();

    const redirectUrl = `${redirectNormalisedUrl}auth/callback/oidc`;

    const finalUrl = `${normalisedUrl}?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${stateKey}&response_type=code&scope=${encodeURIComponent(this.oidcConfiguration.scopes_supported.join(" "))}`;

    const session: OIDCAuthSession = {
      redirectUrl: finalUrl,
      callbackUrl: redirectUrl,
      state: stateKey,
      options: options ?? { redirect: undefined },
    };
    this.signinStateTable[stateKey] = session;
    return session;
  }

  async authorize(
    code: string,
    state: string,
  ): Promise<{ user: UserModel; options: OIDCAuthSessionOptions } | string> {
    const session = this.signinStateTable[state];
    if (!session) return "Invalid state parameter";

    const tokenEndpoint = this.oidcConfiguration.token_endpoint.toString();
    const userinfoEndpoint =
      this.oidcConfiguration.userinfo_endpoint.toString();

    const requestBody = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: session.callbackUrl,
      scope: this.oidcConfiguration.scopes_supported.join(","),
    });

    try {
      const rawTokenResponse = await $fetch<unknown>(tokenEndpoint, {
        body: requestBody,
        method: "POST",
      });
      const tokenResponse = OIDCTokenResponseV1(rawTokenResponse);
      if (tokenResponse instanceof type.errors) {
        logger.error(`Invalid OIDC token response: ${tokenResponse.summary}`);
        return "Invalid token response from identity provider.";
      }

      // TODO: handle refresh tokens?

      const idTokenRaw = await jose.jwtVerify(
        tokenResponse.id_token,
        this.JWKS,
        {
          audience: this.clientId,
          issuer: this.oidcConfiguration.issuer.toString(),
        },
      );
      const idToken = OIDCIDTokenV1(idTokenRaw.payload);
      if (idToken instanceof type.errors) {
        logger.error(`Invalid OIDC ID token: ${idToken.summary}`);
        return "Invalid ID token from identity provider.";
      }

      // TOOD: add sid, sub, & iss to session for logout handling

      const userinfo = await $fetch<OIDCUserInfo>(userinfoEndpoint, {
        headers: {
          Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}`,
        },
      });

      const userOrError = await this.fetchOrCreateUser(userinfo);

      if (typeof userOrError === "string") return userOrError;

      return { user: userOrError, options: session.options };
    } catch (e) {
      logger.error(e);
      return `Request to identity provider failed: ${e}`;
    }
  }

  async fetchOrCreateUser(userinfo: OIDCUserInfo) {
    const existingAuthMek = await prisma.linkedAuthMec.findFirst({
      where: {
        mec: AuthMec.OpenID,
        version: 1,
        credentials: {
          path: ["sub"],
          equals: userinfo.sub,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingAuthMek) return existingAuthMek.user;

    const username = userinfo[this.usernameClaim]?.toString();
    if (!username)
      return "Invalid username claim in OIDC response: " + this.usernameClaim;

    const isAdmin =
      userinfo.groups !== undefined &&
      this.adminGroup !== undefined &&
      userinfo.groups.includes(this.adminGroup);

    const isUser = this.userGroup
      ? userinfo.groups !== undefined &&
        userinfo.groups.includes(this.userGroup)
      : true;

    if (!(isAdmin || isUser))
      return "Not authorized to access this application.";

    /*
    const takenUsername = await prisma.user.count({
      where: {
        username,
      },
    });

    if (takenUsername > 0)
      return "Username already taken. Please contact your server admin.";
    */

    const creds: OIDCAuthMekCredentialsV1 = {
      iss: this.oidcConfiguration.issuer.toString(),
      sub: userinfo.sub,
    };

    const userId = randomUUID();
    const profilePictureId = randomUUID();

    const picture = userinfo.picture;
    if (picture) {
      await objectHandler.createFromSource(
        profilePictureId,
        async () =>
          await $fetch<Readable>(picture, {
            responseType: "stream",
          }),
        {},
        [`internal:read`, `${userId}:read`],
      );
    } else {
      await objectHandler.createFromSource(
        profilePictureId,
        async () => jdenticon.toPng(userinfo.sub, 256),
        {},
        [`internal:read`, `${userId}:read`],
      );
    }

    const created = await prisma.linkedAuthMec.create({
      data: {
        mec: AuthMec.OpenID,
        version: 1,
        user: {
          connectOrCreate: {
            where: {
              username,
            },
            create: {
              id: userId,
              username,
              email: userinfo.email ?? "",
              displayName: userinfo.name ?? username,
              profilePictureObjectId: profilePictureId,
              admin: isAdmin,
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        credentials: creds as any, // Prisma converts this to the Json type for us
      },
      include: {
        user: true,
      },
    });

    return created.user;
  }
}
