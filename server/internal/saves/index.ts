import Stream from "node:stream";
import prisma from "../db/database";
import { applicationSettings } from "../config/application-configuration";
import objectHandler from "../objects";
import { randomUUID, createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

class SaveManager {
  async deleteObjectFromSave(
    gameId: string,
    userId: string,
    index: number,
    objectId: string,
  ) {
    await objectHandler.deleteWithPermission(objectId, userId);
  }

  async pushSave(
    gameId: string,
    userId: string,
    index: number,
    stream: IncomingMessage,
    clientId: string | undefined = undefined,
  ) {
    const save = await prisma.saveSlot.findUnique({
      where: {
        id: {
          userId,
          gameId,
          index,
        },
      },
    });
    if (!save)
      throw createError({ statusCode: 404, message: "Save not found" });

    const newSaveObjectId = randomUUID();
    const newSaveStream = await objectHandler.createWithStream(
      newSaveObjectId,
      { saveSlot: JSON.stringify({ userId, gameId, index }) },
      [],
    );
    if (!newSaveStream)
      throw createError({
        statusCode: 500,
        message: "Failed to create writing stream to storage backend.",
      });

    let hash: string | undefined;
    const hashPromise = Stream.promises.pipeline(
      stream,
      createHash("sha256").setEncoding("hex"),
      async function (source) {
        // @ts-expect-error Not sure how to get this to be typed
        hash = (await source.toArray())[0];
      },
    );

    const uploadStream = Stream.promises.pipeline(stream, newSaveStream);

    await Promise.all([hashPromise, uploadStream]);

    if (!hash) {
      await objectHandler.deleteAsSystem(newSaveObjectId);
      throw createError({
        statusCode: 500,
        message: "Hash failed to generate",
      });
    }

    const newSave = await prisma.saveSlot.update({
      where: {
        id: {
          userId,
          gameId,
          index,
        },
      },
      data: {
        historyObjectIds: {
          push: newSaveObjectId,
        },
        historyChecksums: {
          push: hash,
        },
        ...(clientId && { lastUsedClientId: clientId }),
      },
    });

    const historyLimit = await applicationSettings.get("saveSlotHistoryLimit");
    if (newSave.historyObjectIds.length > historyLimit) {
      // Delete previous
      const safeFromIndex = newSave.historyObjectIds.length - historyLimit;

      const toDelete = newSave.historyObjectIds.slice(0, safeFromIndex);
      const toKeepObjects = newSave.historyObjectIds.slice(safeFromIndex);
      const toKeepHashes = newSave.historyChecksums.slice(safeFromIndex);

      // Delete objects first, so if we error out, we don't lose track of objects in backend
      for (const objectId of toDelete) {
        await this.deleteObjectFromSave(gameId, userId, index, objectId);
      }

      await prisma.saveSlot.update({
        where: {
          id: {
            userId,
            gameId,
            index,
          },
        },
        data: {
          historyObjectIds: toKeepObjects,
          historyChecksums: toKeepHashes,
        },
      });
    }
  }
}

export const saveManager = new SaveManager();
export default saveManager;
