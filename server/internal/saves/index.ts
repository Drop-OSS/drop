import Stream, { Readable } from "stream";
import prisma from "../db/database";
import { applicationSettings } from "../config/application-configuration";
import objectHandler from "../objects";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { IncomingMessage } from "http";

class SaveManager {
  async deleteObjectFromSave(
    gameId: string,
    userId: string,
    index: number,
    objectId: string
  ) {
    await objectHandler.delete(objectId);
  }

  async pushSave(
    gameId: string,
    userId: string,
    index: number,
    stream: IncomingMessage
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
      throw createError({ statusCode: 404, statusMessage: "Save not found" });

    const newSaveObjectId = uuidv4();
    const newSaveStream = await objectHandler.createWithStream(
      newSaveObjectId,
      { saveSlot: JSON.stringify({ userId, gameId, index }) },
      []
    );
    if (!newSaveStream)
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create writing stream to storage backend.",
      });

    let hash: string | undefined;
    const hashPromise = Stream.promises.pipeline(
      stream,
      crypto.createHash("sha256").setEncoding("hex"),
      async function (source) {
        // Not sure how to get this to be typed
        // @ts-expect-error
        hash = (await source.toArray())[0];
      }
    );

    const uploadStream = Stream.promises.pipeline(stream, newSaveStream);

    await Promise.all([hashPromise, uploadStream]);

    if (!hash) {
      await objectHandler.delete(newSaveObjectId);
      throw createError({
        statusCode: 500,
        statusMessage: "Hash failed to generate",
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
        history: {
          push: newSaveObjectId,
        },
        historyChecksums: {
          push: hash,
        },
      },
    });

    const historyLimit = await applicationSettings.get("saveSlotHistoryLimit");
    if (newSave.history.length > historyLimit) {
      // Delete previous
      const safeFromIndex = newSave.history.length - historyLimit;

      const toDelete = newSave.history.slice(0, safeFromIndex);
      const toKeepObjects = newSave.history.slice(safeFromIndex);
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
          history: toKeepObjects,
          historyChecksums: toKeepHashes,
        },
      });
    }
  }
}

export const saveManager = new SaveManager();
export default saveManager;
