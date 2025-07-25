import { ArkErrors, type } from "arktype";
import type { LibraryProvider } from "../provider";
import { VersionNotFoundError } from "../provider";
import { LibraryBackend } from "~/prisma/client/enums";
import fs from "fs";
import path from "path";
import droplet from "@drop-oss/droplet";

export const FlatFilesystemProviderConfig = type({
  baseDir: "string",
});

export class FlatFilesystemProvider
  implements LibraryProvider<typeof FlatFilesystemProviderConfig.infer>
{
  private config: typeof FlatFilesystemProviderConfig.infer;
  private myId: string;

  constructor(rawConfig: unknown, id: string) {
    const config = FlatFilesystemProviderConfig(rawConfig);
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

  type() {
    return LibraryBackend.FlatFilesystem;
  }
  id() {
    return this.myId;
  }

  /**
   * These are basically our versions, but also our games.
   * @returns list of valid games
   */
  async listGames() {
    const versionDirs = fs.readdirSync(this.config.baseDir);
    const validVersionDirs = versionDirs.filter((e) => {
      const fullDir = path.join(this.config.baseDir, e);
      return droplet.hasBackendForPath(fullDir);
    });
    return validVersionDirs;
  }

  /**
   * Doesn't do anything, just returns "default"
   * @param _game Ignored
   * @returns
   */
  async listVersions(_game: string) {
    return ["default"];
  }

  async versionReaddir(game: string, _version: string) {
    const versionDir = path.join(this.config.baseDir, game);
    if (!fs.existsSync(versionDir)) throw new VersionNotFoundError();
    return droplet.listFiles(versionDir);
  }

  async generateDropletManifest(
    game: string,
    _version: string,
    progress: (err: Error | null, v: number) => void,
    log: (err: Error | null, v: string) => void,
  ) {
    const versionDir = path.join(this.config.baseDir, game);
    if (!fs.existsSync(versionDir)) throw new VersionNotFoundError();
    const manifest = await new Promise<string>((r, j) =>
      droplet.generateManifest(versionDir, progress, log, (err, result) => {
        if (err) return j(err);
        r(result);
      }),
    );
    return manifest;
  }
  async peekFile(game: string, _version: string, filename: string) {
    const filepath = path.join(this.config.baseDir, game);
    if (!fs.existsSync(filepath)) return undefined;
    const stat = droplet.peekFile(filepath, filename);
    return { size: Number(stat) };
  }
  async readFile(
    game: string,
    _version: string,
    filename: string,
    options?: { start?: number; end?: number },
  ) {
    const filepath = path.join(this.config.baseDir, game);
    if (!fs.existsSync(filepath)) return undefined;
    const stream = droplet.readFile(
      filepath,
      filename,
      options?.start ? BigInt(options.start) : undefined,
      options?.end ? BigInt(options.end) : undefined,
    );
    if (!stream) return undefined;

    return stream;
  }
}
