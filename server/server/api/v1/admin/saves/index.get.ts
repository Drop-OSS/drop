import { defineEventHandler, getQuery } from "h3";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import prisma from "~/server/internal/db/database";
import { allowSaveAdmin } from "~/server/internal/saves/admin";

/**
 * Every save slot on the server with its owner, player, game and footprint,
 * next to the per-user totals the admin page puts against the quota. Read
 * only - the destructive actions live on the slot and version routes.
 *
 * `?user=<id>` and `?game=<id>` narrow both lists, so a crowded server stays
 * browsable without inventing paging for what is normally a few dozen rows.
 */
export default defineEventHandler(async (event) => {
  await allowSaveAdmin(event);

  const query = getQuery(event);
  const userId = typeof query.user === "string" ? query.user.trim() : "";
  const gameId = typeof query.game === "string" ? query.game.trim() : "";
  const where = {
    ...(userId ? { userId } : {}),
    ...(gameId ? { gameId } : {}),
  };

  const [slots, perSlot, perUser, quotaMb] = await Promise.all([
    prisma.saveSlot.findMany({
      where,
      select: {
        gameId: true,
        userId: true,
        profileId: true,
        index: true,
        label: true,
        playtime: true,
        updatedAt: true,
        headVersionId: true,
        game: { select: { mName: true } },
        user: { select: { username: true } },
        profile: { select: { name: true } },
        _count: { select: { versions: true } },
      },
      orderBy: [
        { user: { username: "asc" } },
        { game: { mName: "asc" } },
        { index: "asc" },
      ],
    }),
    prisma.saveVersion.groupBy({
      by: ["gameId", "userId", "profileId", "slotIndex"],
      where,
      _sum: { sizeBytes: true },
    }),
    prisma.saveVersion.groupBy({
      by: ["userId"],
      where,
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
    applicationSettings.get("saveUserStorageLimit"),
  ]);

  const slotKey = (
    gameId: string,
    userId: string,
    profileId: string,
    i: number,
  ) => `${gameId}|${userId}|${profileId}|${i}`;
  // A slot's footprint is the sum of the versions it keeps; the head's own
  // size is what a device pulls today, so it rides along for the row label.
  const sizes = new Map(
    perSlot.map((row) => [
      slotKey(row.gameId, row.userId, row.profileId, row.slotIndex),
      row._sum.sizeBytes ?? 0,
    ]),
  );
  const headIds = slots
    .map((slot) => slot.headVersionId)
    .filter((id): id is string => !!id);
  const heads = headIds.length
    ? await prisma.saveVersion.findMany({
        where: { id: { in: headIds } },
        select: { id: true, sizeBytes: true },
      })
    : [];
  const headSizes = new Map(
    heads.map((head) => [head.id, head.sizeBytes ?? 0]),
  );

  const owners = [...new Set(perUser.map((row) => row.userId))];
  const accounts = owners.length
    ? await prisma.user.findMany({
        where: { id: { in: owners } },
        select: { id: true, username: true },
      })
    : [];
  const usernames = new Map(accounts.map((a) => [a.id, a.username]));

  return {
    // MB, 0 = unlimited - the same number the client settings advertise.
    quotaMb,
    users: perUser
      .map((row) => ({
        userId: row.userId,
        username: usernames.get(row.userId) ?? row.userId,
        usedBytes: row._sum.sizeBytes ?? 0,
        versionCount: row._count._all,
      }))
      .sort((a, b) => b.usedBytes - a.usedBytes),
    slots: slots.map((slot) => ({
      gameId: slot.gameId,
      game: slot.game.mName,
      userId: slot.userId,
      username: slot.user.username,
      profileId: slot.profileId,
      profile: slot.profile.name,
      index: slot.index,
      label: slot.label,
      playtime: slot.playtime,
      updatedAt: slot.updatedAt,
      headVersionId: slot.headVersionId,
      versionCount: slot._count.versions,
      totalBytes:
        sizes.get(
          slotKey(slot.gameId, slot.userId, slot.profileId, slot.index),
        ) ?? 0,
      headSizeBytes: slot.headVersionId
        ? (headSizes.get(slot.headVersionId) ?? 0)
        : 0,
    })),
  };
});
