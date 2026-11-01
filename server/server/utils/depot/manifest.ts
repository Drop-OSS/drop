import { createHash } from 'node:crypto'
import { canonicalize } from 'json-canonicalize'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ChunkFileResult } from './chunker'

export interface DropletFile { path: string; size: number; sha256: string; chunks: ChunkFileResult['chunks'] }
export interface DropletManifest { format: 'gamedepot-droplet'; version: 1; files: DropletFile[]; chunkIndex: Record<string, { object: string; size: number }>; digest: string }
/** Create deterministic JSON manifest; file paths must be relative and traversal-free. */
export function createDropletManifest(files: Array<{ path: string; content: ChunkFileResult }>): DropletManifest {
  const seen = new Set<string>(), chunkIndex: DropletManifest['chunkIndex'] = {}
  const normalized = [...files].sort((a, b) => a.path.localeCompare(b.path, 'en')).map(({ path, content }) => {
    const p = path.replace(/\\/g, '/').normalize('NFC')
    if (!p || p.startsWith('/') || p.split('/').some(x => !x || x === '.' || x === '..') || seen.has(p)) throw new Error(`Unsafe or duplicate manifest path: ${path}`)
    seen.add(p)
    for (const chunk of content.chunks) {
      const old = chunkIndex[chunk.sha256]
      if (old && (old.size !== chunk.size || old.object !== chunk.object)) throw new Error(`Conflicting chunk ${chunk.sha256}`)
      chunkIndex[chunk.sha256] = { object: chunk.object, size: chunk.size }
    }
    return { path: p, size: content.size, sha256: content.sha256, chunks: content.chunks }
  })
  const base = { format: 'gamedepot-droplet' as const, version: 1 as const, files: normalized, chunkIndex }
  return { ...base, digest: createHash('sha256').update(canonicalize(base)).digest('hex') }
}
export async function writeDropletManifest(path: string, manifest: DropletManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, `${canonicalize(manifest)}\n`, { flag: 'wx' })
  await rename(temp, path)
}
export async function readDropletManifest(path: string): Promise<DropletManifest> {
  const m = JSON.parse(await readFile(path, 'utf8')) as DropletManifest
  const { digest, ...base } = m
  if (m.format !== 'gamedepot-droplet' || m.version !== 1 || createHash('sha256').update(canonicalize(base)).digest('hex') !== digest) throw new Error('Invalid DropletManifest digest or version')
  return m
}
