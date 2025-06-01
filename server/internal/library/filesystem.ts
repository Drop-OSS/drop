import { ArkErrors, type } from "arktype";
import {
  GameNotFoundError,
  VersionNotFoundError,
  type LibraryProvider,
} from "./provider";
import { LibraryBackend } from "~/prisma/client";
import fs from "fs";
import path from "path";
import droplet from "@drop-oss/droplet";
import type { Readable } from "stream";

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
    fs.mkdirSync(this.config.baseDir, { recursive: true });
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

  // TODO: move this over to the droplet.readfile function it works
  async readFile(
    game: string,
    version: string,
    filename: string,
    options?: { start?: number; end?: number },
  ): Promise<Readable | undefined> {
    const filepath = path.join(this.config.baseDir, game, version, filename);
    if (!fs.existsSync(filepath)) return undefined;
    const stream = fs.createReadStream(filepath, options);

    return stream;
  }

  async peekFile(game: string, version: string, filename: string) {
    const filepath = path.join(this.config.baseDir, game, version, filename);
    if (!fs.existsSync(filepath)) return undefined;
    const stat = fs.statSync(filepath);
    return { size: stat.size };
  }
}
