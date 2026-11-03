import { createError, getRouterParam, type H3Event } from "h3";
import aclManager from "../acls";
import prisma from "../db/database";

/**
 * Shared bits for the admin save routes: the ACL the save-manifest admin
 * routes already use (`settings:update`, because these routes read and delete
 * bytes that belong to other accounts) and the param parsing their URLs need.
 */
export async function allowSaveAdmin(event: H3Event): Promise<true> {
  if (!(await aclManager.allowSystemACL(event, ["settings:update"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  return true;
}

/** A save slot's full key, from the four route params that name it. */
export function getSlotKey(event: H3Event): {
  userId: string;
  profileId: string;
  gameId: string;
  index: number;
} {
  const userId = getRouterParam(event, "userid");
  const profileId = getRouterParam(event, "profileid");
  const gameId = getRouterParam(event, "gameid");
  const raw = getRouterParam(event, "index");
  const index = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  if (
    !userId ||
    !profileId ||
    !gameId ||
    !Number.isSafeInteger(index) ||
    index < 0
  )
    throw createError({
      statusCode: 400,
      statusMessage: "A save slot needs userId, profileId, gameId and index",
    });
  return { userId, profileId, gameId, index };
}

/**
 * The slot a version lives in, read off the version itself: a version carries
 * its own key, so an admin names one id and cannot address someone else's row
 * by accident.
 */
export async function requireVersionSlot(event: H3Event): Promise<{
  userId: string;
  profileId: string;
  gameId: string;
  index: number;
  versionId: string;
}> {
  const versionId = getRouterParam(event, "versionid");
  if (!versionId)
    throw createError({ statusCode: 400, statusMessage: "No versionID" });
  const version = await prisma.saveVersion.findUnique({
    where: { id: versionId },
    select: {
      userId: true,
      profileId: true,
      gameId: true,
      slotIndex: true,
    },
  });
  if (!version)
    throw createError({
      statusCode: 404,
      statusMessage: "Save version not found",
    });
  return {
    userId: version.userId,
    profileId: version.profileId,
    gameId: version.gameId,
    index: version.slotIndex,
    versionId,
  };
}
