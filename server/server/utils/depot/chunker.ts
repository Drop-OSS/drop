import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const DEPOT_CHUNK_SIZE = 4 * 1024 * 1024
export interface DepotChunk { index: number; offset: number; size: number; sha256: string; object: string }
export interface ChunkFileResult { size: number; sha256: string; chunks: DepotChunk[] }
export interface ChunkOptions { chunkSize?: number; signal?: AbortSignal; onProgress?: (bytes: number, total: number) => void }
const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Split a file into fixed-size raw chunks and write immutable SHA-256 CAS objects. */
export async function chunkFileToCas(file: string, depotRoot: string, options: ChunkOptions = {}): Promise<ChunkFileResult> {
  const chunkSize = options.chunkSize ?? DEPOT_CHUNK_SIZE
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new Error('chunkSize must be a positive safe integer')
  const total = (await stat(file)).size, hash = createHash('sha256'), chunks: DepotChunk[] = []
  let pending = Buffer.alloc(0), offset = 0, index = 0
  const writeChunk = async (data: Buffer) => {
    const sha256 = digest(data), object = join(depotRoot, 'objects', sha256.slice(0, 2), sha256)
    await mkdir(dirname(object), { recursive: true })
    try { await stat(object) } catch {
      const temp = `${object}.${process.pid}.${Date.now()}.tmp`, handle = await open(temp, 'wx')
      try { await handle.writeFile(data); await handle.sync() } finally { await handle.close() }
      try { await rename(temp, object) } catch (e) { await import('node:fs/promises').then(fs => fs.unlink(temp).catch(() => {})); try { await stat(object) } catch { throw e } }
    }
    chunks.push({ index: index++, offset, size: data.length, sha256, object: `objects/${sha256.slice(0, 2)}/${sha256}` })
    offset += data.length
  }
  for await (const part of createReadStream(file, { highWaterMark: chunkSize })) {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Chunking aborted')
    const buf = Buffer.isBuffer(part) ? part : Buffer.from(part)
    hash.update(buf); options.onProgress?.(offset + buf.length, total)
    pending = pending.length ? Buffer.concat([pending, buf]) : buf
    while (pending.length >= chunkSize) { await writeChunk(pending.subarray(0, chunkSize)); pending = pending.subarray(chunkSize) }
  }
  if (pending.length) await writeChunk(pending)
  return { size: total, sha256: hash.digest('hex'), chunks }
}
