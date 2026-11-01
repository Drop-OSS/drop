import { spawn } from 'node:child_process'
import { mkdir, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

export type Extractor = 'auto' | 'innoextract' | 'mojo' | 'archive'
export interface ExtractOptions { source: string; staging: string; extractor?: Extractor; signal?: AbortSignal }

const run = (bin: string, args: string[], signal?: AbortSignal) => new Promise<void>((ok, fail) => {
  const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], signal })
  let stderr = ''
  child.stderr.setEncoding('utf8').on('data', (s: string) => { stderr = (stderr + s).slice(-8192) })
  child.once('error', fail)
  child.once('close', code => code === 0 ? ok() : fail(new Error(`${bin} exited ${code}: ${stderr}`)))
})

/** Extract installer/archive using locally installed tools. Never invokes a shell. */
export async function extractGogInstaller(options: ExtractOptions): Promise<string> {
  const source = resolve(options.source), staging = resolve(options.staging)
  if (!(await stat(source)).isFile()) throw new Error('GOG installer must be a file')
  await mkdir(staging, { recursive: true })
  const root = await realpath(staging)
  const safeRoot = (candidate: string) => {
    const path = resolve(candidate), rel = relative(root, path)
    if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) throw new Error('Extraction path escapes staging')
  }
  safeRoot(staging)
  const kind = options.extractor ?? 'auto'
  const attempts: Array<[string, string[]]> = []
  if (kind === 'auto' || kind === 'innoextract') attempts.push(['innoextract', ['--extract', '--output-dir', staging, source]])
  if (kind === 'auto' || kind === 'mojo') attempts.push(['mojo', ['unpack', source, staging]])
  if (kind === 'auto' || kind === 'archive') {
    attempts.push(['7z', ['x', '-y', `-o${staging}`, source]])
    attempts.push(['unzip', ['-o', source, '-d', staging]])
    attempts.push(['tar', ['-xf', source, '-C', staging]])
  }
  let last: unknown
  for (const [bin, args] of attempts) {
    try { await run(bin, args, options.signal); return root } catch (error) { last = error }
  }
  throw new Error(`No supported extractor succeeded for ${source}: ${String(last)}`)
}
