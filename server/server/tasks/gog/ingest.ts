import { mkdir, readdir, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { extractGogInstaller } from '../../utils/gog/extractor'
import { chunkFileToCas } from '../../utils/depot/chunker'
import { createDropletManifest, writeDropletManifest } from '../../utils/depot/manifest'

export type ImportStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'
export interface ImportJobStore {
  update(input: { id: string; status: ImportStatus; progress?: number; phase?: string; manifestPath?: string; error?: string }): Promise<unknown>
}
export interface GogIngestInput { id: string; installerPaths: string[]; stagingRoot: string; depotRoot: string }
export interface GogIngestDependencies { jobs: ImportJobStore; emit?: (event: { jobId: string; status: ImportStatus; progress: number; phase: string }) => void; extractor?: (source: string, staging: string) => Promise<string> }
async function filesBelow(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in extracted content: ${p}`)
      if (entry.isDirectory()) await walk(p)
      else if (entry.isFile()) out.push(p)
    }
  }
  await walk(root); return out.sort()
}
/** Execute ingestion against an injected persistence adapter (e.g. Prisma-backed GameImportJob store). */
export async function ingestGogJob(input: GogIngestInput, deps: GogIngestDependencies): Promise<void> {
  const root = resolve(input.stagingRoot, input.id), depot = resolve(input.depotRoot)
  const report = async (status: ImportStatus, progress: number, phase: string, extra: Record<string, unknown> = {}) => {
    await deps.jobs.update({ id: input.id, status, progress, phase, ...extra } as Parameters<ImportJobStore['update']>[0])
    deps.emit?.({ jobId: input.id, status, progress, phase })
  }
  await mkdir(root, { recursive: true }); await report('RUNNING', 0, 'extracting')
  try {
    const extracted: string[] = []
    for (const [i, installer] of input.installerPaths.entries()) {
      const dest = join(root, `installer-${i}`)
      extracted.push(await (deps.extractor ?? ((source, staging) => extractGogInstaller({ source, staging })))(installer, dest))
    }
    const all: string[] = []
    for (const dir of extracted) all.push(...await filesBelow(dir))
    const files = []
    let completed = 0, total = 0
    for (const p of all) total += (await stat(p)).size
    for (const p of all) {
      const rel = relative(root, p).replace(/\\/g, '/')
      const chunked = await chunkFileToCas(p, depot, { onProgress: (n) => { void report('RUNNING', total ? Math.floor((completed + n) * 90 / total) : 90, 'chunking') } })
      files.push({ path: rel, content: chunked }); completed += chunked.size
    }
    const manifest = createDropletManifest(files), manifestPath = join(depot, 'manifests', `${manifest.digest}.json`)
    await writeDropletManifest(manifestPath, manifest)
    await report('COMPLETED', 100, 'published', { manifestPath })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await report('FAILED', 0, 'failed', { error: message }); throw error
  }
}
