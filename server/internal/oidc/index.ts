import { randomUUID } from "crypto";
import prisma from "../db/database";
import { AuthMec } from "@prisma/client";
import objectHandler from "../objects";
import type { Readable } from "stream";
import * as jdenticon from "jdenticon";

interface OIDCWellKnown {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  scopes_supported: string[];
}

interface OIDCAuthSession {
  redirectUrl: string;
  callbackUrl: string;
  state: string;
}

interface OIDCUserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  groups?: Array<string>;
}

export interface OIDCAuthMekCredentialsV1 {
  sub: string;
}

export class OIDCManager {
  private oidcConfiguration: OIDCWellKnown;
  private clientId: string;
  private clientSecret: string;
  private externalUrl: string;

  private adminGroup?: string = process.env.OIDC_ADMIN_GROUP;
  private usernameClaim: keyof OIDCUserInfo =
    (process.env.OIDC_USERNAME_CLAIM as keyof OIDCUserInfo) ??
    "preferred_username";

  private signinStateTable: { [key: string]: OIDCAuthSession } = {};

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
  }

  async create() {
    const wellKnownUrl = process.env.OIDC_WELLKNOWN as string | undefined;
    let configuration: OIDCWellKnown;
    if (wellKnownUrl) {
      const response: OIDCWellKnown = await $fetch<OIDCWellKnown>(wellKnownUrl);
      if (
        !response.authorization_endpoint ||
        !response.scopes_supported ||
        !response.token_endpoint ||
        !response.userinfo_endpoint
      ) {
        throw new Error("Well known response was invalid");
      }

      configuration = response;
    } else {
      const authorizationEndpoint = process.env.OIDC_AUTHORIZATION as
        | string
        | undefined;
      const tokenEndpoint = process.env.OIDC_TOKEN as string | undefined;
      const userinfoEndpoint = process.env.OIDC_USERINFO as string | undefined;
      const scopes = process.env.OIDC_SCOPES as string | undefined;

      if (
        !authorizationEndpoint ||
        !tokenEndpoint ||
        !userinfoEndpoint ||
        !scopes
      ) {
        const debugObject = {
          OIDC_AUTHORIZATION: authorizationEndpoint,
          OIDC_TOKEN: tokenEndpoint,
          OIDC_USERINFO: userinfoEndpoint,
          OIDC_SCOPES: scopes,
        };
        throw new Error(
          "Missing all necessary OIDC configuration: \n" +
            Object.entries(debugObject)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join("\n"),
        );
      }

      configuration = {
        authorization_endpoint: authorizationEndpoint,
        token_endpoint: tokenEndpoint,
        userinfo_endpoint: userinfoEndpoint,
        scopes_supported: scopes.split(","),
      };
    }

    if (!configuration)
      throw new Error("OIDC try to init without configuration");

    const clientId = process.env.OIDC_CLIENT_ID as string | undefined;
    const clientSecret = process.env.OIDC_CLIENT_SECRET as string | undefined;
    const externalUrl = process.env.EXTERNAL_URL as string | undefined;

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

  generateAuthSession(): OIDCAuthSession {
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
    };
    this.signinStateTable[stateKey] = session;
    return session;
  }

  async authorize(code: string, state: string) {
    const session = this.signinStateTable[state];
    if (!session) return "Invalid state parameter";

    const tokenEndpoint = new URL(
      this.oidcConfiguration.token_endpoint,
    ).toString();
    const userinfoEndpoint = new URL(
      this.oidcConfiguration.userinfo_endpoint,
    ).toString();

    const requestBody = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: session.callbackUrl,
      scope: this.oidcConfiguration.scopes_supported.join(","),
    });

    try {
      const { access_token, token_type } = await $fetch<{
        access_token: string;
        token_type: string;
        id_token: string;
      }>(tokenEndpoint, {
        body: requestBody,
        method: "POST",
      });

      const userinfo = await $fetch<OIDCUserInfo>(userinfoEndpoint, {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      });

      const user = await this.fetchOrCreateUser(userinfo);

      return user;
    } catch (e) {
      console.error(e);
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

    const isAdmin =
      userinfo.groups !== undefined &&
      this.adminGroup !== undefined &&
      userinfo.groups.includes(this.adminGroup);

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
              profilePicture: profilePictureId,
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
