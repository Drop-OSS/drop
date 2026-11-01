import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { fetchGogManifestV2, resolveGogDepotItemCdnUrl, type GogContentFileItem } from './cdn'
import { chunkFileToCas } from '../depot/chunker'
import { createDropletManifest, writeDropletManifest } from '../depot/manifest'

export type StreamJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface StreamJobStore {
  update(input: {
    id: string
    status: StreamJobStatus
    progress?: number
    phase?: string
    manifestPath?: string
    error?: string
  }): Promise<unknown>
}

export interface StreamGogGameOptions {
  jobId: string
  productId: string
  generation?: number
  accessToken: string
  depotRoot: string
  stagingRoot: string
  store?: StreamJobStore
  onProgress?: (progress: { phase: string; progress: number; currentItem?: string }) => void
}

/**
 * Downloads a single game file stream directly from GOG CDN and writes it into staging.
 */
async function downloadFileStream(
  cdnUrl: string,
  destinationPath: string,
  signal?: AbortSignal,
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true })
  const response = await fetch(cdnUrl, { signal })
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download stream (${response.status}): ${cdnUrl}`)
  }

  const writeStream = createWriteStream(destinationPath)
  try {
    const readable = Readable.fromWeb(response.body as any)
    readable.pipe(writeStream)
    await finished(writeStream)
  } catch (error) {
    try {
      await unlink(destinationPath)
    } catch {
      // ignore unlink errors on cleanup
    }
    throw error
  }
}

/**
 * Streams unpacked game files directly from GOG content delivery CDN, chunks them into CAS,
 * and writes the DropletManifest v1 directly, bypassing installer extraction.
 */
export async function streamGogGameToDepot(options: StreamGogGameOptions): Promise<string> {
  const {
    jobId,
    productId,
    generation = 2,
    accessToken,
    depotRoot,
    stagingRoot,
    store,
    onProgress,
  } = options

  const report = async (status: StreamJobStatus, progress: number, phase: string, extra: Record<string, unknown> = {}) => {
    if (store) {
      await store.update({ id: jobId, status, progress, phase, ...extra })
    }
    onProgress?.({ phase, progress, currentItem: extra.currentItem as string | undefined })
  }

  const stagedGameDir = resolve(stagingRoot, jobId)
  const resolvedDepotRoot = resolve(depotRoot)
  await mkdir(stagedGameDir, { recursive: true })

  try {
    await report('RUNNING', 2, 'manifest_discovery')

    // 1. Fetch direct game file manifest v2 from GOG content-system
    const manifest = await fetchGogManifestV2(productId, accessToken, generation)
    const depotItems = (manifest.depot?.items ?? []) as GogContentFileItem[]
    const fileItems = depotItems.filter(item => item.path && item.chunks && item.chunks.length > 0)

    const totalFiles = fileItems.length
    if (totalFiles === 0) {
      throw new Error(`No files found in GOG content-system manifest for product ${productId}`)
    }

    // 2. Stream individual game files directly into staged game directory
    let filesDownloaded = 0
    for (const item of fileItems) {
      const targetPath = join(stagedGameDir, item.path)
      const cdnUrl = await resolveGogDepotItemCdnUrl(productId, item.chunks[0].chunk_id, accessToken)
      await downloadFileStream(cdnUrl, targetPath)

      filesDownloaded += 1
      const pct = Math.floor((filesDownloaded / totalFiles) * 50)
      await report('RUNNING', 2 + pct, 'streaming_game_files', { currentItem: item.path })
    }

    // 3. Chunk streamed game files directly to GameDepot CAS objects
    const dropletFiles: { path: string; content: Awaited<ReturnType<typeof chunkFileToCas>> }[] = []
    let filesChunked = 0

    for (const item of fileItems) {
      const filePath = join(stagedGameDir, item.path)
      const chunked = await chunkFileToCas(filePath, resolvedDepotRoot)
      dropletFiles.push({
        path: item.path.replace(/\\/g, '/'),
        content: chunked,
      })

      filesChunked += 1
      const pct = Math.floor((filesChunked / totalFiles) * 40)
      await report('RUNNING', 52 + pct, 'chunking_cas', { currentItem: item.path })
    }

    // 4. Create and write canonical DropletManifest
    const dropletManifest = createDropletManifest(dropletFiles)
    const manifestPath = join(resolvedDepotRoot, 'manifests', `${dropletManifest.digest}.json`)
    await writeDropletManifest(manifestPath, dropletManifest)

    await report('COMPLETED', 100, 'published', { manifestPath })
    return manifestPath
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await report('FAILED', 0, 'failed', { error: message })
    throw error
  }
}
