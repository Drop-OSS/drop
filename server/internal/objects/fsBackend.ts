import type { ObjectMetadata, ObjectReference, Source } from "./objectHandler";
import { ObjectBackend } from "./objectHandler";

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { createHash } from "crypto";
import prisma from "../db/database";
import cacheHandler from "../cache";

export class FsObjectBackend extends ObjectBackend {
  private baseObjectPath: string;
  private baseMetadataPath: string;

  private hashStore = new FsHashStore();

  constructor() {
    super();
    const basePath = process.env.FS_BACKEND_PATH ?? "./.data/objects";
    this.baseObjectPath = path.join(basePath, "objects");
    this.baseMetadataPath = path.join(basePath, "metadata");

    fs.mkdirSync(this.baseObjectPath, { recursive: true });
    fs.mkdirSync(this.baseMetadataPath, { recursive: true });
  }

  async fetch(id: ObjectReference) {
    const objectPath = path.join(this.baseObjectPath, id);
    if (!fs.existsSync(objectPath)) return undefined;
    return fs.createReadStream(objectPath);
  }
  async write(id: ObjectReference, source: Source): Promise<boolean> {
    const objectPath = path.join(this.baseObjectPath, id);
    if (!fs.existsSync(objectPath)) return false;

    // remove item from cache
    await this.hashStore.delete(id);

    if (source instanceof Readable) {
      const outputStream = fs.createWriteStream(objectPath);
      source.pipe(outputStream, { end: true });
      await new Promise((r, _j) => source.on("end", r));
      return true;
    }

    if (source instanceof Buffer) {
      fs.writeFileSync(objectPath, source);
      return true;
    }

    return false;
  }
  async startWriteStream(id: ObjectReference) {
    const objectPath = path.join(this.baseObjectPath, id);
    if (!fs.existsSync(objectPath)) return undefined;
    // remove item from cache
    await this.hashStore.delete(id);
    return fs.createWriteStream(objectPath);
  }
  async create(
    id: string,
    source: Source,
    metadata: ObjectMetadata,
  ): Promise<ObjectReference | undefined> {
    const objectPath = path.join(this.baseObjectPath, id);
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    if (fs.existsSync(objectPath) || fs.existsSync(metadataPath))
      return undefined;

    // Write metadata
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));

    // Create file so write passes
    fs.writeFileSync(objectPath, "");

    // Call write
    this.write(id, source);

    return id;
  }
  async createWithWriteStream(id: string, metadata: ObjectMetadata) {
    const objectPath = path.join(this.baseObjectPath, id);
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    if (fs.existsSync(objectPath) || fs.existsSync(metadataPath))
      return undefined;

    // Write metadata
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));

    // Create file so write passes
    fs.writeFileSync(objectPath, "");

    const stream = await this.startWriteStream(id);
    if (!stream) throw new Error("Could not create write stream");
    return stream;
  }
  async delete(id: ObjectReference): Promise<boolean> {
    const objectPath = path.join(this.baseObjectPath, id);
    if (!fs.existsSync(objectPath)) return true;
    fs.rmSync(objectPath);
    // remove item from cache
    await this.hashStore.delete(id);
    return true;
  }
  async fetchMetadata(
    id: ObjectReference,
  ): Promise<ObjectMetadata | undefined> {
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    if (!fs.existsSync(metadataPath)) return undefined;
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    return metadata as ObjectMetadata;
  }
  async writeMetadata(
    id: ObjectReference,
    metadata: ObjectMetadata,
  ): Promise<boolean> {
    const metadataPath = path.join(this.baseMetadataPath, `${id}.json`);
    if (!fs.existsSync(metadataPath)) return false;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));
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

    // read obj into hash
    obj.pipe(hash);
    await new Promise<void>((r) => {
      obj.on("end", async function () {
        hash.end();
        await store.save(id, hash.read());
        r();
      });
    });

    const result = await this.hashStore.get(id);
    return result === null ? undefined : result;
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
      console.log("object cache hit");
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

    try {
      // need to catch in case the object doesn't exist
      await prisma.objectHash.delete({
        where: {
          id,
        },
      });
    } catch {
      /* empty */
    }
  }
}
