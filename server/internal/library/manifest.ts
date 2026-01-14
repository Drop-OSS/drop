import type { JsonValue } from "@prisma/client/runtime/library";

export type Manifest = V2Manifest;

export type V2Manifest = {
  version: "2";
  size: number;
  key: number[];
  chunks: { [key: string]: V2ChunkData[] };
};

export type V2ChunkData = {
  files: Array<V2FileEntry>;
  checksum: string;
  iv: number[];
};

export type V2FileEntry = {
  filename: string;
  start: number;
  length: number;
  permissions: number;
};

export function castManifest(manifest: JsonValue): Manifest {
  return JSON.parse(manifest as string) as Manifest;
}
