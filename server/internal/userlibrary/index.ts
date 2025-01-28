/*
Handles managing collections
*/

import prisma from "../db/database";

class UserLibraryManager {
  // Caches the user's core library
  private userCoreLibraryCache: { [key: string]: string } = {};

  constructor() {}

  private async fetchUserLibrary(userId: string) {
    if (this.userCoreLibraryCache[userId])
      return this.userCoreLibraryCache[userId];

    let collection = await prisma.collection.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    if (!collection)
      collection = await prisma.collection.create({
        data: {
          name: "Library",
          userId,
          isDefault: true,
        },
      });

    this.userCoreLibraryCache[userId] = collection.id;

    return collection.id;
  }

  async libraryAdd(gameId: string, userId: string) {
    const userLibraryId = await this.fetchUserLibrary(userId);
    await this.collectionAdd(gameId, userLibraryId, userId);
  }

  async libraryRemove(gameId: string, userId: string) {
    const userLibraryId = await this.fetchUserLibrary(userId);
    await this.collectionRemove(gameId, userLibraryId, userId);
  }

  async fetchLibrary(userId: string) {
    const userLibraryId = await this.fetchUserLibrary(userId);
    const userLibrary = await prisma.collection.findUnique({
      where: { id: userLibraryId },
      include: { entries: { include: { game: true } } },
    });
    if (!userLibrary) throw new Error("Failed to load user library");
    return userLibrary;
  }

  // Will not return the default library
  async fetchCollection(collectionId: string) {
    return await prisma.collection.findUnique({
      where: { id: collectionId, isDefault: false },
      include: { entries: { include: { game: true } } },
    });
  }

  async fetchCollections(userId: string) {
    await this.fetchUserLibrary(userId); // Ensures user library exists, doesn't have much performance impact due to caching
    return await prisma.collection.findMany({
      where: { userId, isDefault: false },
      include: {
        entries: {
          include: {
            game: true,
          },
        },
      },
    });
  }

  async collectionAdd(gameId: string, collectionId: string, userId: string) {
    await prisma.collectionEntry.upsert({
      where: {
        collectionId_gameId: {
          collectionId,
          gameId,
        },
        collection: {
          userId,
        },
      },
      create: {
        collectionId,
        gameId,
      },
      update: {},
    });
  }

  async collectionRemove(gameId: string, collectionId: string, userId: string) {
    // Delete if exists
    return (
      (
        await prisma.collectionEntry.deleteMany({
          where: {
            collectionId,
            gameId,
            collection: {
              userId,
            },
          },
        })
      ).count > 0
    );
  }

  async collectionCreate(name: string, userId: string) {
    return await prisma.collection.create({
      data: {
        name,
        userId: userId,
      },
      include: {
        entries: {
          include: {
            game: true,
          },
        },
      },
    });
  }

  async deleteCollection(collectionId: string) {
    await prisma.collection.delete({
      where: {
        id: collectionId,
        isDefault: false,
      },
    });
  }
}

export const userLibraryManager = new UserLibraryManager();
export default userLibraryManager;
