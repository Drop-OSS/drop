import { createError } from "h3";

/**
 * Epic Games distribution manifests.
 *
 * Two distinct things live here, and only one of them is finished:
 *
 * 1. Transport (done): resolving where a build's manifest lives and which CDN
 *    mirrors serve its chunks, plus downloading the manifest bytes. This is
 *    plain HTTPS against Epic's launcher content service and is covered by
 *    hermetic tests.
 *
 * 2. Decoding (NOT IMPLEMENTED): `parseEpicBinaryManifest`. Epic build
 *    manifests are a proprietary binary format (magic 0x44BEC00C, zlib-deflated
 *    blocks holding Unreal property-tag serialized `FManifest` data: file map,
 *    chunk GUID sets, mount/DLC records). There is no public specification, so
 *    any parser written without a real sample to check against is a guess that
 *    looks plausible until it silently mis-groups chunks. This module therefore
 *    fails loudly instead. See `PARSER_STATUS` below.
 */

/** Build/asset record as resolved by `getEpicAssetInfo`, plus resolved download endpoints. */
export interface EpicAssetManifestInfo {
  appName: string;
  catalogItemId: string;
  namespace: string;
  buildVersion: string;
  distributionPoint: string;
  manifestHash?: string;
  /** Direct manifest URL when the caller already resolved one. */
  manifestUrl?: string;
  /** Chunk CDN mirrors; falls back to `distributionPoint` when absent. */
  chunkBaseUrls?: string[];
}

export interface EpicManifestDownloadInfo {
  manifestDownloadUrl: string;
  chunkBaseUrls: string[];
}

/** One file entry of a decoded build manifest. */
export interface EpicParsedFile {
  path: string;
  size: number;
  /** Present only when Epic's manifest carries a whole-file hash for the entry. */
  sha256?: string;
  chunks: Array<{ guid: string }>;
}

export interface EpicParsedManifest {
  files: EpicParsedFile[];
  appVersion?: string;
}

/** Machine-checkable status marker so callers and tests can assert the gap. */
export const PARSER_STATUS = "unimplemented" as const;

const EPIC_LAUNCHER_ASSETS_V2_URL =
  "https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/v2/platform";
const MANIFEST_FETCH_TIMEOUT_MS = 60_000;
/** Build manifests are small; refuse anything absurd rather than buffering it. */
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;

function requireHttps(url: string, what: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: `Epic ${what} is not a valid URL`,
    });
  }
  if (parsed.protocol !== "https:") {
    throw createError({
      statusCode: 502,
      statusMessage: `Refusing non-HTTPS Epic ${what}`,
    });
  }
  return parsed.toString();
}

/**
 * Resolve the manifest location and chunk CDN bases for an Epic build.
 *
 * Uses already-resolved values when the caller supplies them, otherwise queries
 * the launcher content service (`.../assets/v2/platform/{platform}/namespace/...`)
 * which answers with `manifestLocation` plus chunk download base URLs in `meta`.
 */
export async function fetchEpicManifestDownloadUrls(
  assetInfo: EpicAssetManifestInfo,
  accessToken: string,
  platform: string = "Windows",
): Promise<EpicManifestDownloadInfo> {
  const fallbackBases = (
    assetInfo.chunkBaseUrls?.length
      ? assetInfo.chunkBaseUrls
      : [assetInfo.distributionPoint]
  )
    .filter(
      (base): base is string => typeof base === "string" && base.length > 0,
    )
    .map((base) => requireHttps(base, "chunk base URL"));

  if (assetInfo.manifestUrl) {
    return {
      manifestDownloadUrl: requireHttps(assetInfo.manifestUrl, "manifest URL"),
      chunkBaseUrls: fallbackBases,
    };
  }

  const url =
    `${EPIC_LAUNCHER_ASSETS_V2_URL}/${encodeURIComponent(platform)}` +
    `/namespace/${encodeURIComponent(assetInfo.namespace)}` +
    `/catalogItem/${encodeURIComponent(assetInfo.catalogItemId)}` +
    `/appName/${encodeURIComponent(assetInfo.appName)}` +
    `/buildVersion/${encodeURIComponent(assetInfo.buildVersion)}` +
    "/label/Live";

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to query Epic launcher content service",
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw createError({
      statusCode: response.status,
      statusMessage: "Epic rejected the access token",
    });
  }
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Epic launcher content service query failed (${response.status})`,
    });
  }

  const data = (await response.json()) as {
    elements?: Array<{
      manifestLocation?: string;
      meta?: { chunkDownloadBaseUrls?: string[] };
      distributionPoint?: string;
    }>;
  };
  const element = data.elements?.[0];
  if (!element?.manifestLocation) {
    throw createError({
      statusCode: 404,
      statusMessage: "Epic returned no manifest location for this build",
    });
  }

  const mirrorBases = (element.meta?.chunkDownloadBaseUrls ?? [])
    .filter(
      (base): base is string => typeof base === "string" && base.length > 0,
    )
    .map((base) => requireHttps(base, "chunk base URL"));
  const chunkBaseUrls = mirrorBases.length > 0 ? mirrorBases : fallbackBases;
  if (chunkBaseUrls.length === 0) {
    throw createError({
      statusCode: 502,
      statusMessage: "Epic manifest has no chunk distribution endpoints",
    });
  }

  return {
    manifestDownloadUrl: requireHttps(
      element.manifestLocation,
      "manifest location",
    ),
    chunkBaseUrls,
  };
}

/**
 * Download manifest bytes with a bounded size and cancellable timeout. Network
 * failure and non-OK answers surface as typed errors so job workers can record
 * them without string matching.
 */
export async function fetchEpicManifestBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const target = requireHttps(url, "manifest URL");

  let response: Response;
  try {
    response = await fetch(target, {
      headers: { accept: "application/octet-stream" },
      signal: signal ?? AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (signal?.aborted) {
      throw createError({
        statusCode: 499,
        statusMessage: "Epic manifest download aborted",
      });
    }
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch Epic binary manifest: ${(error as Error).message}`,
    });
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Failed to fetch Epic binary manifest (${response.status})`,
    });
  }

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_MANIFEST_BYTES) {
    throw createError({
      statusCode: 502,
      statusMessage: "Epic manifest exceeds the accepted size limit",
    });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MANIFEST_BYTES) {
    throw createError({
      statusCode: 502,
      statusMessage: "Epic manifest exceeds the accepted size limit",
    });
  }
  return bytes;
}

/**
 * Decode an Epic build manifest into logical files and their chunk GUIDs.
 *
 * NOT IMPLEMENTED — see the module header. This throws on purpose rather than
 * returning a partially-guessed structure: an ingestion that mis-parses the file
 * map would publish a corrupt release into the depot CAS under a valid-looking
 * manifest digest.
 *
 * To finish this, implement against a real `manifest_<guid>.bin` sample (from a
 * build the account already owns) and keep the container checks: verify the
 * 0x44BEC00C magic, reject unknown manifest versions, and round-trip the file
 * map/chunk GUID sets in tests before trusting any output.
 */
export function parseEpicBinaryManifest(_manifest: Buffer): EpicParsedManifest {
  throw createError({
    statusCode: 501,
    statusMessage:
      "Epic binary build-manifest decoding is not implemented (PARSER_STATUS=unimplemented): " +
      "the format is proprietary and needs validation against a real manifest sample before ingestion can be trusted",
  });
}
