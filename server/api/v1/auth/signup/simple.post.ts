import { AuthMec, Invitation } from "@prisma/client";
import prisma from "~/server/internal/db/database";
import {
  createHashArgon2,
  simpleAuth,
  SimpleAuthType,
} from "~/server/internal/security/simple";
import { v4 as uuidv4 } from "uuid";
import * as jdenticon from "jdenticon";
import objectHandler from "~/server/internal/objects";
import { type } from "arktype";
import { writeNonLiteralDefaultMessage } from "arktype/internal/parser/shift/operator/default.ts";

const userValidator = type({
  username: "string >= 5",
  email: "string.email",
  password: "string >= 14",
  "displayName?": "string | undefined",
});

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);

  const invitationId = body.invitation;
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

  const user = userValidator(body);
  if (user instanceof type.errors) {
    // hover out.summary to see validation errors
    console.error(user.summary);

    throw createError({
      statusCode: 400,
      statusMessage: user.summary,
    });
  }

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

  const userId = uuidv4();

  const profilePictureId = uuidv4();
  await objectHandler.createFromSource(
    profilePictureId,
    async () => jdenticon.toPng(user.username, 256),
    {},
    [`internal:read`, `${userId}:write`]
  );

  const creds: SimpleAuthType = {
    version: "v1.0.0",
    password: await createHashArgon2(user.password),
  };

  const [linkMec] = await prisma.$transaction([
    prisma.linkedAuthMec.create({
      data: {
        mec: AuthMec.Simple,
        credentials: creds,
        user: {
          create: {
            id: userId,
            username: user.username,
            displayName: user.displayName ?? user.username,
            email: user.email,
            profilePicture: profilePictureId,
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
