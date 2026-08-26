import type { ObjectMetadata, ObjectReference, Source } from "./objectHandler";
import { ObjectBackend, objectMetadata } from "./objectHandler";

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { createHash } from "crypto";
import prisma from "../db/database";
import cacheHandler from "../cache";
import { systemConfig } from "../config/sys-conf";
import { type } from "arktype";
import { logger } from "~/server/internal/logging";
import type pino from "pino";

export class FsObjectBackend extends ObjectBackend {
  private baseObjectPath: string;
  private baseMetadataPath: string;

  private hashStore = new FsHashStore();
  private metadataCache =
    cacheHandler.createCache<ObjectMetadata>("ObjectMetadata");

  constructor() {
    super();
    const basePath = path.join(systemConfig.getDataFolder(), "objects");
    this.baseObjectPath = path.join(basePath, "objects");
    this.baseMetadataPath = path.join(basePath, "metadata");

    fs.mkdirSync(this.baseObjectPath, { recursive: true });
    fs.mkdirSync(this.baseMetadataPath, { recursive: true });
  }

  async fetch(id: ObjectReference) {
    const objectPath = path.join(this.baseObjectPath, id);
    // Open the file first and stream from the handle, so there is no window
    // between checking the file and using it.
    let handle: fs.promises.FileHandle;
    try {
      handle = await fs.promises.open(objectPath, "r");
    } catch {
      return undefined;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) {
        await handle.close();
        return undefined;
      }
    } catch {
      await handle.close();
      return undefined;
    }
    // createReadStream on the fd keeps reads tied to the opened inode.
    return fs
      .createReadStream(undefined as unknown as string, {
        fd: handle.fd,
        autoClose: true,
      })
      .on("close", () => void handle.close().catch(() => {}));
  }
  async write(id: ObjectReference, source: Source): Promise<boolean> {
    const objectPath = path.join(this.baseObjectPath, id);
    // Open with 'r+' so we only write to a file that already exists (created
    // via create()); the check and the write go through the same fd.
    let handle: fs.promises.FileHandle;
    try {
      handle = await fs.promises.open(objectPath, "r+");
    } catch {
      return false;
    }

    // remove item from cache
    await this.hashStore.delete(id);

    try {
      if (source instanceof Readable) {
        const outputStream = handle.createWriteStream();
        source.pipe(outputStream, { end: true });
        await new Promise((r, _j) => source.on("end", r));
        return true;
      }

      if (source instanceof Buffer) {
        await handle.write(source, 0, source.length);
        return true;
      }

      return false;
    } finally {
      await handle.close().catch(() => {});
    }
  }
  async startWriteStream(id: ObjectReference) {
    const objectPath = path.join(this.baseObjectPath, id);
    // 'r+' fails when the file doesn't exist, replacing the existsSync pre-check.
    try {
      const handle = await fs.promises.open(objectPath, "r+");
      // remove item from cache
      await this.hashStore.delete(id);
      return handle.createWriteStream({ autoClose: true });
    } catch {
      return undefined;
    }
  }
  async create(
    id: string,
    source: Source,
    metadata: ObjectMetadata,
  ): Promise<ObjectReference | undefined> {
    const objectPath = path.join(this.baseObjectPath, id);
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);

    // Use exclusive-create flags so concurrent creates cannot clobber each
    // other; failure here means the object already exists.
    try {
      // Write metadata
      fs.writeFileSync(metadataPath, JSON.stringify(metadata), { flag: "wx" });

      // Create file so write passes
      fs.writeFileSync(objectPath, "", { flag: "wx" });
    } catch {
      return undefined;
    }

    // Call write
    this.write(id, source);

    return id;
  }
  async createWithWriteStream(id: string, metadata: ObjectMetadata) {
    const objectPath = path.join(this.baseObjectPath, id);
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);

    // Exclusive-create flags prevent concurrent creates from clobbering.
    try {
      // Write metadata
      fs.writeFileSync(metadataPath, JSON.stringify(metadata), { flag: "wx" });

      // Create file so write passes
      fs.writeFileSync(objectPath, "", { flag: "wx" });
    } catch {
      return undefined;
    }

    const stream = await this.startWriteStream(id);
    if (!stream) throw new Error("Could not create write stream");
    return stream;
  }
  async delete(id: ObjectReference): Promise<boolean> {
    const objectPath = path.join(this.baseObjectPath, id);
    try {
      await fs.promises.rm(objectPath);
    } catch {
      return true;
    }
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    try {
      await fs.promises.rm(metadataPath);
    } catch {
      // Metadata may already be gone; nothing to do.
    }
    // remove item from caches
    await this.metadataCache.remove(id);
    await this.hashStore.delete(id);
    return true;
  }
  async fetchMetadata(
    id: ObjectReference,
  ): Promise<ObjectMetadata | undefined> {
    const cacheResult = await this.metadataCache.get(id);
    if (cacheResult !== null) return cacheResult;

    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    let metadataRaw: string;
    try {
      metadataRaw = await fs.promises.readFile(metadataPath, "utf-8");
    } catch {
      return undefined;
    }
    const metadata = objectMetadata(JSON.parse(metadataRaw));
    if (metadata instanceof type.errors) {
      logger.error(
        { summary: metadata.summary },
        "FsObjectBackend#fetchMetadata",
      );
      return undefined;
    }
    await this.metadataCache.set(id, metadata);
    return metadata;
  }
  async writeMetadata(
    id: ObjectReference,
    metadata: ObjectMetadata,
  ): Promise<boolean> {
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    try {
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata), {
        flag: "r+",
      });
    } catch {
      return false;
    }
    await this.metadataCache.set(id, metadata);
    return true;
  }
  async fetchHash(id: ObjectReference): Promise<string | undefined> {
    const cacheResult = await this.hashStore.get(id);
    if (cacheResult !== null) return cacheResult;

    const obj = await this.fetch(id);
    if (obj === undefined) return;

    // hash object
    const hash = createHash("md5");
    hash.setEncoding("hex");

    // local variable to point to object
    const store = this.hashStore;
    let hashResult = "";

    const objEnd = new Promise<void>((r) => {
      obj.on("end", async function () {
        hash.end();
        hashResult = hash.read();
        r();
      });
    });
    // read obj into hash
    obj.pipe(hash);
    await objEnd;

    // if hash isn't a string somehow, mark as unknown hash
    if (typeof hashResult !== "string") {
      return undefined;
    }
    await store.save(id, hashResult);
    return typeof hashResult;
  }

  async listAll(): Promise<string[]> {
    return fs.readdirSync(this.baseObjectPath);
  }

  async cleanupMetadata(taskLogger: pino.Logger) {
    const cleanupLogger = taskLogger ?? logger;

    const metadataFiles = fs.readdirSync(this.baseMetadataPath);
    const objects = await this.listAll();

    const extraFiles = metadataFiles.filter(
      (file) => !objects.includes(file.replace(/\.json$/, "")),
    );
    cleanupLogger.info(
      `[FsObjectBackend#cleanupMetadata]: Found ${extraFiles.length} metadata files without corresponding objects.`,
    );
    for (const file of extraFiles) {
      const filePath = path.join(this.baseMetadataPath, file);
      try {
        fs.rmSync(filePath);
        cleanupLogger.info(
          `[FsObjectBackend#cleanupMetadata]: Removed ${file}`,
        );
      } catch (error) {
        cleanupLogger.error(
          { error },
          `[FsObjectBackend#cleanupMetadata]: Failed to remove ${file}`,
        );
      }
    }
  }
}

class FsHashStore {
  private cache = cacheHandler.createCache<string>("ObjectHashStore");

  /**
   * Gets hash of object
   * @param id
   * @returns
   */
  async get(id: ObjectReference) {
    const cacheRes = await this.cache.get(id);
    if (cacheRes !== null) {
      return cacheRes;
    }

    const objectHash = await prisma.objectHash.findUnique({
      where: {
        id,
      },
      select: {
        hash: true,
      },
    });
    if (objectHash === null) return undefined;
    await this.cache.set(id, objectHash.hash);
    return objectHash.hash;
  }

  /**
   * Saves hash of object
   * @param id
   */
  async save(id: ObjectReference, hash: string) {
    await prisma.objectHash.upsert({
      where: {
        id,
      },
      create: {
        id,
        hash,
      },
      update: {
        hash,
      },
    });
    await this.cache.set(id, hash);
  }

  /**
   * Hash is no longer valid for whatever reason
   * @param id
   */
  async delete(id: ObjectReference) {
    await this.cache.remove(id);
    await prisma.objectHash.deleteMany({
      where: {
        id,
      },
    });
  }
}
