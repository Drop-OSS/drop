import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import objectHandler from "../objects";
import stream from "node:stream/promises";
import prisma from "../db/database";

class ScreenshotManager {
  async get(id: string) {
    return await prisma.screenshot.findUnique({
      where: {
        id,
      },
    });
  }

  async getAllByGame(gameId: string, userId: string) {
    const results = await prisma.screenshot.findMany({
      where: {
        gameId,
        userId,
      },
    });
    return results;
  }

  async delete(id: string) {
    await prisma.screenshot.delete({
      where: {
        id,
      },
    });
  }

  async upload(gameId: string, userId: string, inputStream: IncomingMessage) {
    const objectId = randomUUID();
    const saveStream = await objectHandler.createWithStream(objectId, {}, []);
    if (!saveStream)
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create writing stream to storage backend.",
      });

    // pipe into object store
    await stream.pipeline(inputStream, saveStream);

    // TODO: set createAt to the time screenshot was taken
    await prisma.screenshot.create({
      data: {
        gameId,
        userId,
        objectId,
      },
    });
  }
}

export const screenshotManager = new ScreenshotManager();
export default screenshotManager;
