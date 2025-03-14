import { AuthMec } from "@prisma/client";
import { JsonArray } from "@prisma/client/runtime/library";
import prisma from "~/server/internal/db/database";
import { checkHash } from "~/server/internal/security/simple";
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
      credentials: {
        array_starts_with: username,
      },
      enabled: true,
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

  const credentials = authMek.credentials as JsonArray;
  const hash = credentials.at(1);

  if (!hash || !authMek.user.enabled)
    throw createError({
      statusCode: 403,
      statusMessage:
        "Invalid or disabled account. Please contact the server administrator.",
    });

  if (!(await checkHash(password, hash.toString())))
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid username or password.",
    });

  await sessionHandler.setUserId(h3, authMek.userId, rememberMe);

  return { result: true, userId: authMek.userId };
});
