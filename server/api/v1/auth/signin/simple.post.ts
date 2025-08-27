import { AuthMec } from "~/prisma/client/enums";
import type { JsonArray } from "@prisma/client/runtime/library";
import { type } from "arktype";
import prisma from "~/server/internal/db/database";
import sessionHandler from "~/server/internal/session";
import authManager, {
  checkHashArgon2,
  checkHashBcrypt,
} from "~/server/internal/auth";
import { logger } from "~/server/internal/logging";

const signinValidator = type({
  username: "string",
  password: "string",
  "rememberMe?": "boolean | undefined",
});

export default defineEventHandler<{
  body: typeof signinValidator.infer;
}>(async (h3) => {
  const t = await useTranslation(h3);

  if (!authManager.getAuthProviders().Simple)
    throw createError({
      statusCode: 403,
      message: t("errors.auth.method.signinDisabled"),
    });

  const body = signinValidator(await readBody(h3));
  if (body instanceof type.errors) {
    // hover out.summary to see validation errors
    logger.error(body.summary);

    throw createError({
      statusCode: 400,
      message: body.summary,
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
      message: t("errors.auth.invalidUserOrPass"),
    });

  if (!authMek.user.enabled)
    throw createError({
      statusCode: 403,
      message: t("errors.auth.disabled"),
    });

  // LEGACY bcrypt
  if (authMek.version == 1) {
    const credentials = authMek.credentials as JsonArray | null;
    const hash = credentials?.at(1)?.toString();

    if (!hash)
      throw createError({
        statusCode: 500,
        message: t("errors.auth.invalidPassState"),
      });

    if (!(await checkHashBcrypt(body.password, hash)))
      throw createError({
        statusCode: 401,
        message: t("errors.auth.invalidUserOrPass"),
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
      message: t("errors.auth.invalidPassState"),
    });

  if (!(await checkHashArgon2(body.password, hash)))
    throw createError({
      statusCode: 401,
      message: t("errors.auth.invalidUserOrPass"),
    });

  await sessionHandler.signin(h3, authMek.userId, body.rememberMe);
  return { result: true, userId: authMek.userId };
});
