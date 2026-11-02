import { createError, getHeader, getQuery, getRouterParam } from "h3";
import type { H3Event } from "h3";
import { ClientCapabilities, SaveVersionKind } from "~/prisma/client/enums";
import { SaveConflictError } from "./errors";
import { isSha256 } from "./hash";

export function assertCloudSaves(client: {
  capabilities: ClientCapabilities[];
}): void {
  if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
    throw createError({
      statusCode: 403,
      statusMessage: "Capability not allowed.",
    });
}

export function getGameId(event: H3Event): string {
  const gameId = getRouterParam(event, "gameid");
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "No gameID in route params",
    });
  return gameId;
}

export function getSlotIndex(event: H3Event): number {
  const raw = getRouterParam(event, "slotindex");
  if (!raw)
    throw createError({
      statusCode: 400,
      statusMessage: "No slotIndex in route params",
    });
  const index = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(index) || index < 0)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid slotIndex",
    });
  return index;
}

export function getVersionId(event: H3Event): string {
  const versionId = getRouterParam(event, "versionid");
  if (!versionId)
    throw createError({
      statusCode: 400,
      statusMessage: "No versionID in route params",
    });
  return versionId;
}

/** `If-Match` carries the client's base version ID; absent or `*` means none. */
export function getBaseVersionId(event: H3Event): string | null {
  const raw = getHeader(event, "if-match")?.trim();
  if (!raw || raw === "*") return null;
  return raw.replace(/^W\//, "").replace(/^"|"$/g, "");
}

export function getOptionalSha256(
  event: H3Event,
  header: string,
): string | null {
  const raw = getHeader(event, header)?.trim();
  if (!raw) return null;
  if (!isSha256(raw))
    throw createError({
      statusCode: 400,
      statusMessage: `${header} must be a SHA-256 hex digest`,
    });
  return raw.toLowerCase();
}

export function getQueryOptional(event: H3Event, name: string): string | null {
  const raw = getQuery(event)[name];
  if (typeof raw !== "string") return null;
  return raw.trim() || null;
}

export function getQueryOptionalSha256(
  event: H3Event,
  name: string,
): string | null {
  const raw = getQueryOptional(event, name);
  if (!raw) return null;
  if (!isSha256(raw))
    throw createError({
      statusCode: 400,
      statusMessage: `${name} must be a SHA-256 hex digest`,
    });
  return raw.toLowerCase();
}

export function getOptionalIntHeader(
  event: H3Event,
  header: string,
): number | null {
  const raw = getHeader(event, header)?.trim();
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 0)
    throw createError({
      statusCode: 400,
      statusMessage: `${header} must be a non-negative integer`,
    });
  return value;
}

export function getIdempotencyKey(event: H3Event): string | null {
  const raw = getHeader(event, "idempotency-key")?.trim();
  return raw && raw.length <= 200 ? raw : null;
}

const kinds: Record<string, SaveVersionKind> = {
  backup: SaveVersionKind.Backup,
  restore: SaveVersionKind.Restore,
  conflictkeeplocal: SaveVersionKind.ConflictKeepLocal,
  import: SaveVersionKind.Import,
  safety: SaveVersionKind.Safety,
};

export function rethrowSaveError(error: unknown): never {
  if (error instanceof SaveConflictError)
    throw createError({
      statusCode: 409,
      statusMessage: "Save conflict",
      data: { headVersionId: error.headVersionId },
    });
  throw error;
}

export function getVersionKind(event: H3Event): SaveVersionKind {
  const query = getQuery(event);
  const raw =
    (typeof query.kind === "string" ? query.kind : undefined) ??
    getHeader(event, "x-save-kind") ??
    "backup";
  const kind = kinds[raw.toLowerCase()];
  if (!kind)
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown save version kind: ${raw}`,
    });
  return kind;
}
