import { AuthMec } from "@prisma/client";
import { Readable } from "stream";
import prisma from "~/server/internal/db/database";
import { createHash } from "~/server/internal/security/simple";
import { v4 as uuidv4 } from "uuid";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);

  const username = body.username;
  const password = body.password;
  if (username === undefined || password === undefined)
    throw createError({
      statusCode: 403,
      statusMessage: "Username or password missing from request.",
    });

  const existing = await prisma.user.count({ where: { username: username } });
  if (existing > 0)
    throw createError({
      statusCode: 400,
      statusMessage: "Username already taken.",
    });

  const userId = uuidv4();

  const profilePictureObject = await h3.context.objects.createFromSource(
    () =>
      $fetch<Readable>("https://avatars.githubusercontent.com/u/64579723?v=4", {
        responseType: "stream",
      }),
    {},
    [`anonymous:read`, `${userId}:write`]
  );
  if (!profilePictureObject)
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to import profile picture",
    });

  const user = await prisma.user.create({
    data: {
      username,
      displayName: "",
      email: "",
      profilePicture: profilePictureObject,
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

  return user;
});
