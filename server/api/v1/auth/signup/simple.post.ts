import { AuthMec, Invitation } from "@prisma/client";
import prisma from "~/server/internal/db/database";
import { createHash } from "~/server/internal/security/simple";
import { v4 as uuidv4 } from "uuid";
import * as jdenticon from "jdenticon";

// Only really a simple test, in case people mistype their emails
const mailRegex = /^\S+@\S+\.\S+$/;

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

  const useInvitationOrBodyRequirement = (
    field: keyof Invitation,
    check: (v: string) => boolean
  ) => {
    if (invitation[field]) {
      return invitation[field].toString();
    }

    const v: string = body[field]?.toString();
    const valid = check(v);
    return valid ? v : undefined;
  };

  const username = useInvitationOrBodyRequirement(
    "username",
    (e) => e.length >= 5
  );
  const email = useInvitationOrBodyRequirement("email", (e) =>
    mailRegex.test(e)
  );
  const password = body.password;
  const displayName = body.displayName || username;

  if (username === undefined)
    throw createError({
      statusCode: 400,
      statusMessage: "Username is invalid. Must be more than 5 characters.",
    });
  if (username.toLowerCase() != username)
    throw createError({
      statusCode: 400,
      statusMessage: "Username must be all lowercase",
    });

  if (email === undefined)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid email. Must follow the format you@example.com",
    });

  if (!password)
    throw createError({
      statusCode: 400,
      statusMessage: "Password empty or missing.",
    });

  if (password.length < 14)
    throw createError({
      statusCode: 400,
      statusMessage: "Password must be 14 or more characters.",
    });

  const existing = await prisma.user.count({ where: { username: username } });
  if (existing > 0)
    throw createError({
      statusCode: 400,
      statusMessage: "Username already taken.",
    });

  const userId = uuidv4();

  const profilePictureId = uuidv4();
  await h3.context.objects.createFromSource(
    profilePictureId,
    async () => jdenticon.toPng(username, 256),
    {},
    [`anonymous:read`, `${userId}:write`]
  );
  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      email,
      profilePicture: profilePictureId,
      admin: true,
    },
  });

  const hash = await createHash(password);
  await prisma.linkedAuthMec.create({
    data: {
      mec: AuthMec.Simple,
      credentials: [username, hash],
      userId: user.id,
    },
  });

  await prisma.invitation.delete({ where: { id: invitationId } });

  return user;
});
