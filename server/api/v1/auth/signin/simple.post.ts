import { AuthMec } from "@prisma/client";
import { JsonArray } from "@prisma/client/runtime/library";
import { type } from "arktype";
import prisma from "~/server/internal/db/database";
import {
  checkHashArgon2,
  checkHashBcrypt,
  simpleAuth,
} from "~/server/internal/security/simple";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);

  const username = body.username;
  const password = body.password;
  const rememberMe = body.rememberMe ?? false;
  if (username === undefined || password === undefined)
    throw createError({
      statusCode: 403,
      statusMessage: "Username or password missing from request.",
    });

  const authMek = await prisma.linkedAuthMec.findFirst({
    where: {
      mec: AuthMec.Simple,
      enabled: true,
      user: {
        username,
      },
    },
    include: {
      user: {
        select: {
          enabled: true,
        },
      },
    },
  });

  if (!authMek)
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid username or password.",
    });
  else if (!authMek.user.enabled)
    throw createError({
      statusCode: 403,
      statusMessage:
        "Invalid or disabled account. Please contact the server administrator.",
    });

  // if using old auth schema
  if (Array.isArray(authMek.credentials)) {
    const hash = authMek.credentials.at(1)?.toString();

    if (!hash)
      throw createError({
        statusCode: 403,
        statusMessage:
          "Invalid password state. Please contact the server administrator.",
      });

    if (!(await checkHashBcrypt(password, hash)))
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid username or password.",
      });

    // TODO: send user to forgot password screen or something to force them to change their password to new system
    await sessionHandler.setUserId(h3, authMek.userId, rememberMe);
    return { result: true, userId: authMek.userId };
  } else {
    // using new (modern) login flow

    const creds = simpleAuth(authMek.credentials);
    if (creds instanceof type.errors) {
      // hover out.summary to see validation errors
      console.error(creds.summary);

      throw createError({
        statusCode: 403,
        statusMessage:
          "Invalid password state. Please contact the server administrator.",
      });
    }

    if (!(await checkHashArgon2(password, creds.password)))
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid username or password.",
      });

    await sessionHandler.setUserId(h3, authMek.userId, rememberMe);

    return { result: true, userId: authMek.userId };
  }
});
