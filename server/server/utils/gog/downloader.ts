import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

export interface GogDownloadFile {
  name: string
  downlink: string
}

export interface GogDownloadOptions {
  stagingRoot: string
  jobId: string
  accessToken?: string
  onProgress?: (bytesWritten: number, totalBytes?: number) => void
}

/**
 * Streams files securely from GOG CDN into the staging directory for an ingestion job.
 */
export async function downloadGogFiles(
  files: GogDownloadFile[],
  options: GogDownloadOptions
): Promise<string[]> {
  const downloadDir = join(options.stagingRoot, options.jobId, 'downloads')
  await mkdir(downloadDir, { recursive: true })

  const savedPaths: string[] = []

  for (const file of files) {
    const targetPath = join(downloadDir, file.name)
    await mkdir(dirname(targetPath), { recursive: true })

    const headers: Record<string, string> = {
      'User-Agent': 'GameDepot/1.0 (+https://github.com/cmspeedau/GameDepot)',
    }

    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`
    }

    const response = await fetch(file.downlink, { headers })

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${file.name} from GOG CDN: HTTP ${response.status} ${response.statusText}`)
    }

    const totalBytes = Number(response.headers.get('content-length')) || undefined
    let written = 0

    // ReadableStream to Node.js Readable adapter
    const nodeStream = Readable.fromWeb(response.body as any)

    nodeStream.on('data', (chunk: Buffer) => {
      written += chunk.length
      options.onProgress?.(written, totalBytes)
    })

    const writeStream = createWriteStream(targetPath)
    await pipeline(nodeStream, writeStream)

    savedPaths.push(targetPath)
  }

  return savedPaths
}
