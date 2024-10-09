/**
 * Objects are basically files, like images or downloads, that have a set of metadata and permissions attached
 * They're served by the API from the /api/v1/object/${objectId} endpoint.
 *
 * It supports streams and buffers, depending on the use case. Buffers will likely only be used internally if
 * the data needs to be manipulated somehow.
 *
 * Objects are designed to be created once, and link to a single ID. For example, each user gets a single object
 * that's tied to their profile picture. If they want to update their profile picture, they overwrite that object.
 *
 * Permissions are a list of strings. Each permission string is in the id:permission format. Eg
 * anonymous:read
 * myUserId:read
 * anotherUserId:write
 */

import { parse as getMimeTypeBuffer } from "file-type-mime";
import { Readable } from "stream";
import { getMimeType as getMimeTypeStream } from "stream-mime-type";

export type ObjectReference = string;
export type ObjectMetadata = {
  mime: string;
  permissions: string[];
  userMetadata: { [key: string]: string };
};

export enum ObjectPermission {
  Read = "read",
  Write = "write",
  Delete = "delete",
}
export const ObjectPermissionPriority: Array<ObjectPermission> = [
  ObjectPermission.Read,
  ObjectPermission.Write,
  ObjectPermission.Delete,
];

export type Object = { mime: string; data: Source };

export type Source = Readable | Buffer;

export abstract class ObjectBackend {
  // Interface functions, not designed to be called directly.
  // They don't check permissions to provide any utilities
  abstract fetch(id: ObjectReference): Promise<Source | undefined>;
  abstract write(id: ObjectReference, source: Source): Promise<boolean>;
  abstract create(
    source: Source,
    metadata: ObjectMetadata
  ): Promise<ObjectReference | undefined>;
  abstract delete(id: ObjectReference): Promise<boolean>;
  abstract fetchMetadata(
    id: ObjectReference
  ): Promise<ObjectMetadata | undefined>;
  abstract writeMetadata(
    id: ObjectReference,
    metadata: ObjectMetadata
  ): Promise<boolean>;

  async createFromSource(
    sourceFetcher: () => Promise<Source>,
    metadata: { [key: string]: string },
    permissions: Array<string>
  ) {
    async function fetchMimeType(source: Source) {
      if (source instanceof ReadableStream) {
        source = Readable.from(source);
      }
      if (source instanceof Readable) {
        const { stream, mime } = await getMimeTypeStream(source);
        return { source: Readable.from(stream), mime: mime };
      }
      if (source instanceof Buffer) {
        const mime =
          getMimeTypeBuffer(source)?.mime ?? "application/octet-stream";
        return { source: source, mime };
      }

      return { source: undefined, mime: undefined };
    }
    const { source, mime } = await fetchMimeType(await sourceFetcher());
    if (!mime)
      throw new Error("Unable to calculate MIME type - is the source empty?");

    const objectId = this.create(source, {
      permissions,
      userMetadata: metadata,
      mime,
    });

    return objectId;
  }

  async fetchWithPermissions(id: ObjectReference, userId?: string) {
    const metadata = await this.fetchMetadata(id);
    if (!metadata) return;

    // We only need one permission, so find instead of filter is faster
    const myPermissions = metadata.permissions.find((e) => {
      if (userId !== undefined && e.startsWith(userId)) return true;
      if (userId !== undefined && e.startsWith("internal")) return true;
      if (e.startsWith("anonymous")) return true;
      return false;
    });

    if (!myPermissions) {
      // We do not have access to this object
      return;
    }

    // Because any permission can be read or up, we automatically know we can read this object
    // So just straight return the object
    const source = await this.fetch(id);
    if (!source) return undefined;
    const object: Object = {
      data: source,
      mime: metadata.mime,
    };
    return object;
  }

  // If we need to fetch a remote resource, it doesn't make sense
  // to immediately fetch the object, *then* check permissions.
  // Instead the caller can pass a simple anonymous funciton, like
  // () => $fetch('/my-image');
  // And if we actually have permission to write, it fetches it then.
  async writeWithPermissions(
    id: ObjectReference,
    sourceFetcher: () => Promise<Source>,
    userId?: string
  ) {
    const metadata = await this.fetchMetadata(id);
    if (!metadata) return;

    const myPermissions = metadata.permissions
      .filter((e) => {
        if (userId !== undefined && e.startsWith(userId)) return true;
        if (e.startsWith("anonymous")) return true;
        return false;
      })
      // Strip IDs from permissions
      .map((e) => e.split(":").at(1))
      // Map to priority according to array
      .map((e) => ObjectPermissionPriority.findIndex((c) => c === e));

    const requiredPermissionIndex = 1;
    const hasPermission =
      myPermissions.find((e) => e >= requiredPermissionIndex) != undefined;

    if (!hasPermission) return false;

    const source = await sourceFetcher();
    const result = await this.write(id, source);

    return result;
  }

  async deleteWithPermission(id: ObjectReference, userId?: string) {
    const metadata = await this.fetchMetadata(id);
    if (!metadata) return false;

    const myPermissions = metadata.permissions
      .filter((e) => {
        if (userId !== undefined && e.startsWith(userId)) return true;
        if (userId !== undefined && e.startsWith("internal")) return true;
        if (e.startsWith("anonymous")) return true;
        return false;
      })
      // Strip IDs from permissions
      .map((e) => e.split(":").at(1))
      // Map to priority according to array
      .map((e) => ObjectPermissionPriority.findIndex((c) => c === e));

    const requiredPermissionIndex = 2;
    const hasPermission =
      myPermissions.find((e) => e >= requiredPermissionIndex) != undefined;

    if (!hasPermission) return false;

    const result = await this.delete(id);
    return result;
  }
}
