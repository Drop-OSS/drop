import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import objectHandler from "../objects";
import stream from "node:stream/promises";
import prisma from "../db/database";

class ScreenshotManager {
  /**
   * Gets a specific screenshot
   * @param id
   * @returns
   */
  async get(id: string) {
    return await prisma.screenshot.findUnique({
      where: {
        id,
      },
    });
  }

  /**
   * Get all user screenshots
   * @param userId
   * @returns
   */
  async getUserAll(userId: string) {
    const results = await prisma.screenshot.findMany({
      where: {
        userId,
      },
    });
    return results;
  }

  /**
   * Get all user screenshots in a specific game
   * @param userId
   * @param gameId
   * @returns
   */
  async getUserAllByGame(userId: string, gameId: string) {
    const results = await prisma.screenshot.findMany({
      where: {
        gameId,
        userId,
      },
    });
    return results;
  }

  /**
   * Delete a specific screenshot
   * @param id
   */
  async delete(id: string) {
    await prisma.screenshot.delete({
      where: {
        id,
      },
    });
  }

  /**
   * Allows a user to upload a screenshot
   * @param userId
   * @param gameId
   * @param inputStream
   */
  async upload(userId: string, gameId: string, inputStream: IncomingMessage) {
    const objectId = randomUUID();
    const saveStream = await objectHandler.createWithStream(
      objectId,
      {
        // TODO: set createAt to the time screenshot was taken
        createdAt: new Date().toISOString(),
      },
      [`${userId}:read`, `${userId}:delete`],
    );
    if (!saveStream)
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create writing stream to storage backend.",
      });

    // pipe into object store
    await stream.pipeline(inputStream, saveStream);

    await prisma.screenshot.create({
      data: {
        gameId,
        userId,
        objectId,
        private: true,
      },
    });
  }
}

export const screenshotManager = new ScreenshotManager();
export default screenshotManager;
