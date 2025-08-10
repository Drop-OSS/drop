import { AuthMec } from "~/prisma/client/enums";
import prisma from "~/server/internal/db/database";
import authManager, { createHashArgon2 } from "~/server/internal/auth";
import * as jdenticon from "jdenticon";
import objectHandler from "~/server/internal/objects";
import { type } from "arktype";
import { randomUUID } from "node:crypto";
import { throwingArktype } from "~/server/arktype";

export const SharedRegisterValidator = type({
  username: "string >= 5",
  email: "string.email",
});

const CreateUserValidator = SharedRegisterValidator.and({
  invitation: "string",
  password: "string >= 14",
  "displayName?": "string | undefined",
}).configure(throwingArktype);

/**
 * Create user from invitation
 */
export default defineEventHandler<{
  body: typeof CreateUserValidator.infer;
}>(async (h3) => {
  const t = await useTranslation(h3);

  if (!authManager.getAuthProviders().Simple)
    throw createError({
      statusCode: 403,
      statusMessage: t("errors.auth.method.signinDisabled"),
    });

  const user = await readValidatedBody(h3, CreateUserValidator);

  const invitation = await prisma.invitation.findUnique({
    where: { id: user.invitation },
  });
  if (!invitation)
    throw createError({
      statusCode: 401,
      statusMessage: t("errors.auth.invalidInvite"),
    });

  // reuse items from invite
  if (invitation.username !== null) user.username = invitation.username;
  if (invitation.email !== null) user.email = invitation.email;

  const existing = await prisma.user.count({
    where: { username: user.username },
  });
  if (existing > 0)
    throw createError({
      statusCode: 400,
      statusMessage: t("errors.auth.usernameTaken"),
    });

  const userId = randomUUID();

  const profilePictureId = randomUUID();
  await objectHandler.createFromSource(
    profilePictureId,
    async () => jdenticon.toPng(user.username, 256),
    {},
    [`internal:read`, `${userId}:read`],
  );
  const [linkMec] = await prisma.$transaction([
    prisma.linkedAuthMec.create({
      data: {
        mec: AuthMec.Simple,
        credentials: await createHashArgon2(user.password),
        version: 2,
        user: {
          create: {
            id: userId,
            username: user.username,
            displayName: user.displayName ?? user.username,
            email: user.email,
            profilePictureObjectId: profilePictureId,
            admin: invitation.isAdmin,
          },
        },
      },
      select: {
        user: true,
      },
    }),
    prisma.invitation.delete({ where: { id: user.invitation } }),
  ]);

  return linkMec.user;
});
