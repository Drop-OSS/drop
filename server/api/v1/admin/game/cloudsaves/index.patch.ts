import { type } from "arktype";
import { CloudSaveType } from "~/prisma/client";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const UpdateEntry = type({
  id: "string",
  name: "string",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "game:cloudsaves:update",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, UpdateEntry);
  const entry = await prisma.ludusaviEntry.findUnique({
    where: {
      name: body.name,
    },
    include: {
      entries: true,
    },
  });
  if (!entry)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Ludusavi name",
    });

  const configuration = await prisma.cloudSaveConfiguration.upsert({
    where: {
      gameId: body.id,
    },
    create: {
      gameId: body.id,
      type: CloudSaveType.Ludusavi,
      ludusaviEntryName: entry.name,
    },
    update: {
      type: CloudSaveType.Ludusavi,
      ludusaviEntryName: entry.name,
    },
    include: {
      ludusaviEntry: {
        include: {
          entries: true,
        },
      },
    },
  });

  await prisma.game.update({
    where: {
      id: body.id,
    },
    data: {
      cloudSaveConfiguration: {
        connect: {
          gameId: body.id,
        },
      },
    },
  });

  return configuration;
});
