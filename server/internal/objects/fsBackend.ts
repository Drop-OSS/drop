import { Object, ObjectBackend, ObjectMetadata, ObjectReference, Source } from ".";

import sanitize from "sanitize-filename";

import fs from "fs";
import path from "path";
import { Readable, Stream } from "stream";
import { v4 as uuidv4 } from "uuid";

export class FsObjectBackend extends ObjectBackend {
  private baseObjectPath: string;
  private baseMetadataPath: string;

  constructor() {
    super();
    const basePath = process.env.FS_BACKEND_PATH ?? "./.data/objects";
    this.baseObjectPath = path.join(basePath, "objects");
    this.baseMetadataPath = path.join(basePath, "metadata");

    fs.mkdirSync(this.baseObjectPath, { recursive: true });
    fs.mkdirSync(this.baseMetadataPath, { recursive: true });
  }

  async fetch(id: ObjectReference) {
    const objectPath = path.join(this.baseObjectPath, sanitize(id));
    if (!fs.existsSync(objectPath)) return undefined;
    return fs.createReadStream(objectPath);
  }
  async write(id: ObjectReference, source: Source): Promise<boolean> {
    const objectPath = path.join(this.baseObjectPath, sanitize(id));
    if (!fs.existsSync(objectPath)) return false;

    if (source instanceof Readable) {
      const outputStream = fs.createWriteStream(objectPath);
      source.pipe(outputStream, { end: true });
      await new Promise((r, j) => source.on("end", r));
      return true;
    }

    if (source instanceof Buffer) {
      fs.writeFileSync(objectPath, source);
      return true;
    }

    return false;
  }
  async create(
    source: Source,
    metadata: ObjectMetadata
  ): Promise<ObjectReference | undefined> {
    const id = uuidv4();
    const objectPath = path.join(this.baseObjectPath, sanitize(id));
    const metadataPath = path.join(
      this.baseMetadataPath,
      `${sanitize(id)}.json`
    );
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
  async delete(id: ObjectReference): Promise<boolean> {
    const objectPath = path.join(this.baseObjectPath, sanitize(id));
    if (!fs.existsSync(objectPath)) return true;
    fs.rmSync(objectPath);
    return true;
  }
  async fetchMetadata(
    id: ObjectReference
  ): Promise<ObjectMetadata | undefined> {
    const metadataPath = path.join(
      this.baseMetadataPath,
      `${sanitize(id)}.json`
    );
    if (!fs.existsSync(metadataPath)) return undefined;
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    return metadata as ObjectMetadata;
  }
  async writeMetadata(
    id: ObjectReference,
    metadata: ObjectMetadata
  ): Promise<boolean> {
    const metadataPath = path.join(
      this.baseMetadataPath,
      `${sanitize(id)}.json`
    );
    if (!fs.existsSync(metadataPath)) return false;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));
    return true;
  }
}
