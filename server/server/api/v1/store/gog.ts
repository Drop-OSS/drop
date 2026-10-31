import {
  defineEventHandler,
  readBody,
  createError,
  getQuery,
} from "h3";
import { prisma } from "../../../../internal/prisma";
import { mustBeAdmin } from "../../../../internal/auth";

const GOG_AUTH_URL = "https://auth.gog.com/auth";
const GOG_TOKEN_URL = "https://auth.gog.com/token";
const GOG_CLIENT_ID = "46899977057790700"; // GOG Galaxy client ID for OAuth
const GOG_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client";

export default defineEventHandler(async (event) => {
  await mustBeAdmin(event);
  const method = event.node.req.method;

  if (method === "GET") {
    const query = getQuery(event);

    if (query.action === "auth-url") {
      const loginUrl = `${GOG_AUTH_URL}?client_id=${GOG_CLIENT_ID}&layout=client2&redirect_uri=${encodeURIComponent(
        GOG_REDIRECT_URI,
      )}&response_type=code`;

      return {
        url: loginUrl,
        instructions:
          "Open this URL, log in to GOG, and copy the 'code' parameter from the redirected page URL.",
      };
    }

    // List all connected store accounts
    const accounts = await prisma.storeConnection.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return accounts;
  }

  if (method === "POST") {
    const body = await readBody(event);
    const { code, provider = "GOG" } = body;

    if (!code) {
      throw createError({
        statusCode: 400,
        statusMessage: "Authorization code is required",
      });
    }

    // Exchange auth code for tokens via GOG token service
    try {
      const tokenResponse = await fetch(
        `${GOG_TOKEN_URL}?client_id=${GOG_CLIENT_ID}&grant_type=authorization_code&code=${encodeURIComponent(
          code,
        )}&redirect_uri=${encodeURIComponent(GOG_REDIRECT_URI)}`,
      );

      if (!tokenResponse.ok) {
        const errorDetail = await tokenResponse.text();
        throw createError({
          statusCode: 400,
          statusMessage: `GOG OAuth exchange failed: ${errorDetail}`,
        });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const userId = tokenData.user_id;

      // Fetch user profile from GOG
      let accountName = `GOG User (${userId})`;
      try {
        const profileRes = await fetch("https://embed.gog.com/userData.json", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.username) {
            accountName = profile.username;
          }
        }
      } catch {
        // Fall back to account ID if profile fetch fails
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

      // Upsert the store connection
      const connection = await prisma.storeConnection.upsert({
        where: {
          provider_storeUserId: {
            provider: provider as "GOG",
            storeUserId: String(userId),
          },
        },
        update: {
          accountName,
          accessToken,
          refreshToken,
          tokenExpiresAt: expiresAt,
          syncStatus: "IDLE",
        },
        create: {
          provider: provider as "GOG",
          accountName,
          storeUserId: String(userId),
          accessToken,
          refreshToken,
          tokenExpiresAt: expiresAt,
          syncStatus: "IDLE",
        },
      });

      return {
        success: true,
        account: connection,
      };
    } catch (err: any) {
      throw createError({
        statusCode: 500,
        statusMessage: err.message || "Failed to link GOG account",
      });
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: "Method Not Allowed",
  });
});
