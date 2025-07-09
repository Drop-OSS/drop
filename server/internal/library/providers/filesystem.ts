import { ArkErrors, type } from "arktype";
import {
  GameNotFoundError,
  VersionNotFoundError,
  type LibraryProvider,
} from "../provider";
import { LibraryBackend } from "~/prisma/client/enums";
import fs from "fs";
import path from "path";
import droplet from "@drop-oss/droplet";

export const FilesystemProviderConfig = type({
  baseDir: "string",
});

export class FilesystemProvider
  implements LibraryProvider<typeof FilesystemProviderConfig.infer>
{
  private config: typeof FilesystemProviderConfig.infer;
  private myId: string;

  constructor(rawConfig: unknown, id: string) {
    const config = FilesystemProviderConfig(rawConfig);
    if (config instanceof ArkErrors) {
      throw new Error(
        `Failed to create filesystem provider: ${config.summary}`,
      );
    }

    this.myId = id;
    this.config = config;

    if (!fs.existsSync(this.config.baseDir))
      throw "Base directory does not exist.";
  }

  id(): string {
    return this.myId;
  }

  type(): LibraryBackend {
    return LibraryBackend.Filesystem;
  }

  async listGames(): Promise<string[]> {
    const dirs = fs.readdirSync(this.config.baseDir);
    const folderDirs = dirs.filter((e) => {
      const fullDir = path.join(this.config.baseDir, e);
      return fs.lstatSync(fullDir).isDirectory();
    });
    return folderDirs;
  }

  async listVersions(game: string): Promise<string[]> {
    const gameDir = path.join(this.config.baseDir, game);
    if (!fs.existsSync(gameDir)) throw new GameNotFoundError();
    const versionDirs = fs.readdirSync(gameDir);
    const validVersionDirs = versionDirs.filter((e) => {
      const fullDir = path.join(this.config.baseDir, game, e);
      return droplet.hasBackendForPath(fullDir);
    });
    return validVersionDirs;
  }

  async versionReaddir(game: string, version: string): Promise<string[]> {
    const versionDir = path.join(this.config.baseDir, game, version);
    if (!fs.existsSync(versionDir)) throw new VersionNotFoundError();
    return droplet.listFiles(versionDir);
  }

  async generateDropletManifest(
    game: string,
    version: string,
    progress: (err: Error | null, v: number) => void,
    log: (err: Error | null, v: string) => void,
  ): Promise<string> {
    const versionDir = path.join(this.config.baseDir, game, version);
    if (!fs.existsSync(versionDir)) throw new VersionNotFoundError();
    const manifest = await new Promise<string>((r, j) =>
      droplet.generateManifest(versionDir, progress, log, (err, result) => {
        if (err) return j(err);
        r(result);
      }),
    );
    return manifest;
  }

  async peekFile(game: string, version: string, filename: string) {
    const filepath = path.join(this.config.baseDir, game, version);
    if (!fs.existsSync(filepath)) return undefined;
    const stat = droplet.peekFile(filepath, filename);
    return { size: stat };
  }

  async readFile(
    game: string,
    version: string,
    filename: string,
    options?: { start?: number; end?: number },
  ) {
    const filepath = path.join(this.config.baseDir, game, version);
    if (!fs.existsSync(filepath)) return undefined;
    const stream = droplet.readFile(
      filepath,
      filename,
      options?.start,
      options?.end,
    );
    if (!stream) return undefined;

    return stream;
  }
}
