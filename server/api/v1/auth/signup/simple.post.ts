import { AuthMec } from "~/prisma/client";
import prisma from "~/server/internal/db/database";
import { createHashArgon2 } from "~/server/internal/security/simple";
import * as jdenticon from "jdenticon";
import objectHandler from "~/server/internal/objects";
import { type } from "arktype";
import { randomUUID } from "node:crypto";
import { throwingArktype } from "~/server/arktype";

export const CreateUserValidator = type({
  invitation: "string?", // Optional because we re-use this validator
  username: "string >= 5",
  email: "string.email",
  password: "string >= 14",
  "displayName?": "string | undefined",
}).configure(throwingArktype);

export default defineEventHandler<{
  body: typeof CreateUserValidator.infer;
}>(async (h3) => {
  const user = await readValidatedBody(h3, CreateUserValidator);

  const invitationId = user.invitation;
  if (!invitationId)
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired invitation.",
    });

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation)
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired invitation.",
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
      statusMessage: "Username already taken.",
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
    prisma.invitation.delete({ where: { id: invitationId } }),
  ]);

  return linkMec.user;
});
