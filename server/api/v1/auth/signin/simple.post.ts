import { AuthMec } from "~/prisma/client";
import type { JsonArray } from "@prisma/client/runtime/library";
import { type } from "arktype";
import prisma from "~/server/internal/db/database";
import {
  checkHashArgon2,
  checkHashBcrypt,
} from "~/server/internal/security/simple";
import sessionHandler from "~/server/internal/session";
import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

const signinValidator = type({
  username: "string",
  password: "string",
  "rememberMe?": "boolean | undefined",
});

export default defineEventHandler(async (h3) => {
  if (!enabledAuthManagers.Simple)
    throw createError({
      statusCode: 403,
      statusMessage: "Sign in method not enabled",
    });

  const body = signinValidator(await readBody(h3));
  if (body instanceof type.errors) {
    // hover out.summary to see validation errors
    console.error(body.summary);

    throw createError({
      statusCode: 400,
      statusMessage: body.summary,
    });
  }

  const authMek = await prisma.linkedAuthMec.findFirst({
    where: {
      mec: AuthMec.Simple,
      enabled: true,
      user: {
        username: body.username,
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

  if (!authMek.user.enabled)
    throw createError({
      statusCode: 403,
      statusMessage:
        "Invalid or disabled account. Please contact the server administrator.",
    });

  // LEGACY bcrypt
  if (authMek.version == 1) {
    const credentials = authMek.credentials as JsonArray | null;
    const hash = credentials?.at(1)?.toString();

    if (!hash)
      throw createError({
        statusCode: 403,
        statusMessage:
          "Invalid password state. Please contact the server administrator.",
      });

    if (!(await checkHashBcrypt(body.password, hash)))
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid username or password.",
      });

    // TODO: send user to forgot password screen or something to force them to change their password to new system
    await sessionHandler.signin(h3, authMek.userId, body.rememberMe);
    return { result: true, userId: authMek.userId };
  }

  // V2: argon2
  const hash = authMek.credentials as string | undefined;
  if (!hash || typeof hash !== "string")
    throw createError({
      statusCode: 500,
      statusMessage:
        "Invalid password state. Please contact the server administrator.",
    });

  if (!(await checkHashArgon2(body.password, hash)))
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid username or password.",
    });

  await sessionHandler.signin(h3, authMek.userId, body.rememberMe);
  return { result: true, userId: authMek.userId };
});
