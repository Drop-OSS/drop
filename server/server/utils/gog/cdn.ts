import { createError } from "h3";
import { inflateSync } from "node:zlib";

/**
 * GOG content-system access, verified live against a real entitled account
 * in Nov 2026 (Timberborn): the build list answers `{ items }` with
 * snake_case fields and no depot info; the per-build `link` document
 * (zlib-compressed) carries the depots and their manifest hashes; each
 * depot's file list lives on the content CDN under /content-system/v2/meta/
 * (also zlib); and every chunk URL must be signed by the product's
 * secure_link endpoint. The former direct /manifests/<hash>.json and
 * /chunks/... paths 404 - they belonged to a retired API shape.
 */
const GOG_CONTENT_SYSTEM = "https://content-system.gog.com";
const GOG_CONTENT_CDN = "https://gog-cdn-fastly.gog.com";

export interface GogCdnCredentials {
  accessToken: string;
}

export interface GogBuildDetails {
  buildId: string;
  productId: string;
  os?: string;
  branch?: string | null;
  versionName?: string;
  generation?: number;
  datePublished?: string;
  /** Fetchable (zlib-compressed) build meta with depots[] and manifests. */
  link: string;
}

type GogBuildListItem = {
  build_id?: string;
  product_id?: string;
  os?: string;
  branch?: string | null;
  version_name?: string;
  generation?: number;
  date_published?: string;
  link?: string;
};

export interface GogMetaDepot {
  manifest: string;
  productId?: string;
  size?: number;
  compressedSize?: number;
  languages?: string[];
  osBitness?: string[];
  isGogDepot?: boolean;
}

export interface GogBuildMeta {
  buildId?: string;
  baseProductId?: string;
  installDirectory?: string;
  depots: GogMetaDepot[];
}

export interface GogFileChunk {
  /** MD5 of the stored (zlib-compressed) bytes when present. */
  compressedMd5?: string;
  compressedSize?: number;
  /** MD5 of the decompressed bytes. */
  md5: string;
  size: number;
}

export interface GogManifestFile {
  path: string;
  size: number;
  md5?: string;
  sha256?: string;
  chunks: GogFileChunk[];
  flags?: string[];
}

export interface GogDepotManifest {
  files: GogManifestFile[];
  totalSize: number;
}

export interface GogSecureEndpoint {
  endpoint_name?: string;
  url_format: string;
  parameters: Record<string, string | undefined>;
  priority?: number;
  fallback_only?: boolean;
}

/** `a1/b2/a1b2...` - GOG's two-level hash prefixing used everywhere. */
export function gogGalaxyPath(hash: string): string {
  if (hash.includes("/")) return hash;
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;
}

/** GOG serves several content endpoints zlib-compressed with a plain JSON
 * body and no Content-Encoding; mirror the client's tolerant decode. */
async function getZlibJson(
  response: Response,
  failureMessage: string,
): Promise<Record<string, unknown>> {
  const buffer = Buffer.from(await response.arrayBuffer());
  try {
    return JSON.parse(inflateSync(buffer).toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    try {
      return JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw createError({ statusCode: 502, statusMessage: failureMessage });
    }
  }
}

/**
 * Lists the downloadable builds of a product, newest first.
 */
export async function getGogProductBuilds(
  productId: string,
  credentials: GogCdnCredentials,
  options: { generation?: number; os?: string } = {},
): Promise<GogBuildDetails[]> {
  const os = options.os ?? "windows";
  const generation = options.generation ?? 2;
  const url = new URL(
    `${GOG_CONTENT_SYSTEM}/products/${encodeURIComponent(productId)}/os/${encodeURIComponent(os)}/builds`,
  );
  url.searchParams.set("generation", String(generation));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw createError({
      statusCode:
        response.status === 401 || response.status === 403
          ? response.status
          : 502,
      statusMessage: `Failed to fetch GOG build details: ${response.statusText}`,
    });
  }

  const data = (await response.json()) as { items?: GogBuildListItem[] };
  return (data.items ?? [])
    .filter(
      (item): item is GogBuildListItem & { link: string; build_id: string } =>
        Boolean(item.link && item.build_id),
    )
    .map((item) => ({
      buildId: item.build_id,
      productId: item.product_id ?? productId,
      os: item.os,
      branch: item.branch,
      versionName: item.version_name,
      generation: item.generation,
      datePublished: item.date_published,
      link: item.link,
    }));
}

/**
 * Fetches the zlib-compressed build meta (depot list, install directory).
 * The build `link` is pre-authorized; the token rides along harmlessly.
 */
export async function getGogBuildMeta(
  link: string,
  credentials: GogCdnCredentials,
): Promise<GogBuildMeta> {
  const response = await fetch(link, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch the GOG build meta (${response.status})`,
    });
  }
  const meta = (await getZlibJson(
    response,
    "The GOG build meta was not readable",
  )) as { depots?: GogMetaDepot[] };
  return {
    buildId: (meta as { buildId?: string }).buildId,
    baseProductId: (meta as { baseProductId?: string }).baseProductId,
    installDirectory: (meta as { installDirectory?: string }).installDirectory,
    depots: meta.depots ?? [],
  };
}

/**
 * Fetches one depot's file manifest (DepotFile/DepotDirectory/DepotLink
 * items) from the content CDN. No credentials: the CDN meta path is open.
 */
export async function getGogDepotManifest(
  manifestHash: string,
): Promise<GogDepotManifest> {
  const url = `${GOG_CONTENT_CDN}/content-system/v2/meta/${gogGalaxyPath(manifestHash)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch GOG depot manifest ${manifestHash} (${response.status})`,
    });
  }
  const payload = (await getZlibJson(
    response,
    `GOG depot manifest ${manifestHash} was not readable`,
  )) as { depot?: { items?: GogDepotItem[] } };

  type GogDepotItem = {
    type?: string;
    path?: string;
    md5?: string;
    sha256?: string;
    flags?: string[];
    chunks?: GogFileChunk[];
  };
  const files: GogManifestFile[] = [];
  for (const item of payload.depot?.items ?? []) {
    if (item.type !== "DepotFile" || !item.path) continue;
    const chunks = item.chunks ?? [];
    files.push({
      // Windows-authored depots carry backslash paths; the depot CAS
      // stores logical POSIX paths.
      path: item.path.replace(/\\/g, "/").replace(/^\/+/, ""),
      size: chunks.reduce((sum, chunk) => sum + (chunk.size ?? 0), 0),
      md5: item.md5,
      sha256: item.sha256,
      chunks,
      flags: item.flags,
    });
  }
  return {
    files,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
  };
}

/**
 * Signs the chunk-download URL template for a product. The returned
 * endpoints embed a time-limited token in the query; download requests
 * themselves carry no Authorization header.
 */
export async function getGogSecureLinks(
  productId: string,
  credentials: GogCdnCredentials,
): Promise<GogSecureEndpoint[]> {
  const url = new URL(
    `${GOG_CONTENT_SYSTEM}/products/${encodeURIComponent(productId)}/secure_link`,
  );
  url.searchParams.set("_version", "2");
  url.searchParams.set("generation", "2");
  url.searchParams.set("path", "/");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw createError({
      statusCode:
        response.status === 401 || response.status === 403
          ? response.status
          : 502,
      statusMessage: `Failed to obtain a GOG download secure link (${response.status})`,
    });
  }
  const data = (await response.json()) as { urls?: GogSecureEndpoint[] };
  const endpoints = (data.urls ?? []).filter((entry) => entry.url_format);
  if (endpoints.length === 0) {
    throw createError({
      statusCode: 502,
      statusMessage: "GOG returned no download endpoints for this product",
    });
  }
  return endpoints.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/**
 * Fills one secure endpoint template for a chunk (or store path). The
 * client appends the chunk's galaxy path to the endpoint's `path`
 * parameter before substituting, exactly as the launcher does.
 */
export function buildGogChunkUrl(
  endpoint: GogSecureEndpoint,
  galaxySuffix: string,
): string {
  let url = endpoint.url_format;
  for (const [key, value] of Object.entries(endpoint.parameters)) {
    if (value === undefined) continue;
    const replacement = key === "path" ? `${value}/${galaxySuffix}` : value;
    url = url.replaceAll(`{${key}}`, replacement);
  }
  return url;
}
