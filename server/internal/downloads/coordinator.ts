import prisma from "../db/database";
import type { DropManifest } from "./manifest";

const TIMEOUT = 1000 * 60 * 60 * 1; // 1 hour

class DownloadContextManager {
  private contexts: Map<
    string,
    {
      timeout: Date;
      manifest: DropManifest;
      versionName: string;
      libraryId: string;
      libraryPath: string;
    }
  > = new Map();

  async createContext(game: string, versionPath: string) {
    const version = await prisma.version.findFirst({
      where: {
        gameId: game,
        versionPath,
        gameVersion: {
          isNot: null,
        },
      },
      include: {
        game: {
          select: {
            libraryId: true,
            libraryPath: true,
          },
        },
      },
    });
    if (!version) return undefined;

    const contextId = crypto.randomUUID();
    this.contexts.set(contextId, {
      timeout: new Date(),
      manifest: JSON.parse(version.dropletManifest as string) as DropManifest,
      versionName: versionPath,
      libraryId: version.game!.libraryId!,
      libraryPath: version.game!.libraryPath,
    });

    return contextId;
  }

  async fetchContext(contextId: string) {
    const context = this.contexts.get(contextId);
    if (!context) return undefined;
    context.timeout = new Date();
    this.contexts.set(contextId, context);
    return context;
  }

  async cleanup() {
    for (const key of this.contexts.keys()) {
      const context = this.contexts.get(key)!;
      if (context.timeout.getTime() < Date.now() - TIMEOUT) {
        this.contexts.delete(key);
      }
    }
  }
}

export const contextManager = new DownloadContextManager();
export default contextManager;
