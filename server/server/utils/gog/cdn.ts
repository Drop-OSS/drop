import { createError } from 'h3'

const GOG_CDN_BASE = 'https://content-system.gog.com'

export interface GogCdnCredentials {
  accessToken: string
}

export interface GogBuildProductItem {
  name: string
  path: string
  size: number
  md5?: string
}

export interface GogBuildDepotItem {
  id: string
  manifest?: string
  compressedSize?: number
  size?: number
}

export interface GogBuildDetails {
  buildId: string
  productId: string
  generation?: number
  versionName?: string
  depots?: GogBuildDepotItem[]
  items?: GogBuildProductItem[]
  [key: string]: unknown
}

export interface GogFileChunk {
  compressedMd5?: string
  compressedSize: number
  md5: string
  size: number
}

export interface GogManifestFile {
  path: string
  size: number
  md5?: string
  chunks?: GogFileChunk[]
  flags?: number
}

export interface GogDepotManifest {
  depotId: string
  manifestId: string
  files: GogManifestFile[]
  totalSize: number
}

/**
 * Resolves the build manifest list for a given product from GOG's content system CDN.
 * Used to get build generation, depot IDs, and active manifests without downloading installers.
 */
export async function getGogProductBuilds(
  productId: string,
  credentials: GogCdnCredentials,
  options: { generation?: number; os?: string } = {}
): Promise<GogBuildDetails[]> {
  const os = options.os ?? 'windows'
  const generation = options.generation ?? 2
  const url = new URL(`${GOG_CDN_BASE}/products/${encodeURIComponent(productId)}/os/${encodeURIComponent(os)}/builds`)
  url.searchParams.set('generation', String(generation))

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw createError({
      statusCode: response.status === 401 || response.status === 403 ? response.status : 502,
      statusMessage: `Failed to fetch GOG build details: ${response.statusText}`,
    })
  }

  const data = (await response.json()) as { items?: GogBuildDetails[] }
  return data.items ?? []
}

/**
 * Retrieves the GOG depot manifest (content directory structure and chunk/file hashes).
 */
export async function getGogDepotManifest(
  manifestHash: string,
  credentials: GogCdnCredentials
): Promise<GogDepotManifest> {
  const prefix = manifestHash.slice(0, 2)
  const secondPrefix = manifestHash.slice(2, 4)
  const url = `${GOG_CDN_BASE}/manifests/${prefix}/${secondPrefix}/${manifestHash}.json`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw createError({
      statusCode: response.status === 401 || response.status === 403 ? response.status : 502,
      statusMessage: `Failed to fetch GOG depot manifest: ${response.statusText}`,
    })
  }

  return (await response.json()) as GogDepotManifest
}

/**
 * Generates the secure chunk URL for streaming a specific content chunk directly from GOG CDN.
 */
export function getGogChunkUrl(chunkCompressedMd5: string): string {
  const prefix = chunkCompressedMd5.slice(0, 2)
  const secondPrefix = chunkCompressedMd5.slice(2, 4)
  return `${GOG_CDN_BASE}/chunks/${prefix}/${secondPrefix}/${chunkCompressedMd5}`
}
