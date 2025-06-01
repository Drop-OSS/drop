import type { Readable } from "stream";
import type { LibraryBackend } from "~/prisma/client";

export abstract class LibraryProvider<CFG> {
  constructor(_config: CFG, _id: string) {
    throw new Error("Library doesn't have a proper constructor");
  }

  /**
   * @returns ID of the current library provider (fs, smb, s3, etc)
   */
  abstract type(): LibraryBackend;

  /**
   * @returns the specific ID of this current provider
   */
  abstract id(): string;

  /**
   * @returns list of (usually) top-level game folder names
   */
  abstract listGames(): Promise<string[]>;

  /**
   * @param game folder name of the game to list versions for
   * @returns list of version folder names
   */
  abstract listVersions(game: string): Promise<string[]>;

  /**
   * @param game folder name of the game
   * @param version folder name of the version
   * @returns recursive list of all files in version, relative to the version folder (e.g. ./setup.exe)
   */
  abstract versionReaddir(game: string, version: string): Promise<string[]>;

  /**
   * @param game folder name of the game
   * @param version folder name of the version
   * @returns string of JSON of the droplet manifest
   */
  abstract generateDropletManifest(
    game: string,
    version: string,
    progress: (err: Error | null, v: number) => void,
    log: (err: Error | null, v: string) => void,
  ): Promise<string>;

  abstract peekFile(
    game: string,
    version: string,
    filename: string,
  ): Promise<{ size: number } | undefined>;

  abstract readFile(
    game: string,
    version: string,
    filename: string,
    options?: { start?: number; end?: number },
  ): Promise<Readable | undefined>;
}

export class GameNotFoundError extends Error {}
export class VersionNotFoundError extends Error {}
