import { createError } from "h3";
import pluginManager from "../../plugins";
import type {
  DepotDownloadStream,
  DepotStorageProvider,
} from "../../plugins/types";

export interface ResolvedRemoteDepot {
  providerId: string;
  stream: DepotDownloadStream;
}

/**
 * Resolve a remote depot stream for `gameId` from the registered
 * `DepotStorageProvider`s. Providers are consulted in registration order; the
 * first non-empty stream wins. Returns `null` when no provider can serve it so
 * the caller can fall back to a local/library backend.
 */
export async function resolveRemoteDepot(
  gameId: string,
  depotId: string,
  providers: DepotStorageProvider[] = pluginManager.getDepotProviders(),
): Promise<ResolvedRemoteDepot | null> {
  for (const provider of providers) {
    let stream: DepotDownloadStream | null = null;
    try {
      stream = await provider.resolveDepotStream(depotId, gameId);
    } catch {
      // A failing provider must not block the others; fail soft here and let
      // the caller report "no remote depot" if none succeed.
      continue;
    }
    if (stream && (stream.url || stream.pieceReader)) {
      return { providerId: provider.id, stream };
    }
  }
  return null;
}

/**
 * Read `length` bytes at `offset` from a resolved remote depot stream.
 *
 * A provider may expose either an HTTP `url` (+ optional `headers`, used with a
 * `Range` request) or a `pieceReader(offset, length)` callback. Both are
 * addressed in bytes from the start of the depot's content stream.
 */
export async function readRemoteRange(
  stream: DepotDownloadStream,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "offset must be a non-negative integer",
    });
  }
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "length must be a positive integer",
    });
  }

  if (stream.pieceReader) {
    const data = await stream.pieceReader(offset, length);
    if (!(data instanceof Uint8Array)) {
      throw createError({
        statusCode: 502,
        statusMessage: "Remote depot pieceReader returned a non-binary value",
      });
    }
    return data;
  }

  if (!stream.url) {
    throw createError({
      statusCode: 501,
      statusMessage: "Remote depot stream exposes neither url nor pieceReader",
    });
  }

  const headers = new Headers(stream.headers ?? {});
  headers.set("Range", `bytes=${offset}-${offset + length - 1}`);
  const response = await fetch(stream.url, { headers });
  if (!response.ok && response.status !== 206) {
    throw createError({
      statusCode: 502,
      statusMessage: `Remote depot read failed (${response.status})`,
    });
  }
  return new Uint8Array(await response.arrayBuffer());
}
