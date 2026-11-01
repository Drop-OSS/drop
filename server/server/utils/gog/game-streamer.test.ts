import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { streamGogGameToDepot, type StreamJobStore } from './game-streamer'
import { readDropletManifest } from '../depot/manifest'
import type { GogBuildDetails, GogManifestFile } from './cdn'
/** Assert an h3-style typed error: a status code and, optionally, a message fragment. */
function typedError(statusCode: number, message?: RegExp) {
  return (error: unknown): boolean => {
    const thrown = error as { statusCode?: number; statusMessage?: string; message?: string } | null
    const text = thrown?.statusMessage ?? thrown?.message ?? ''
    return thrown?.statusCode === statusCode && (message === undefined || message.test(text))
  }
}
/** Some lib configurations do not type Buffer as a valid Response body. */
function binaryResponse(bytes: Buffer, init?: ResponseInit): Response {
  return new Response(new Uint8Array(bytes), init)
}

/**
 * Hermetic streamer tests: GOG's content-system endpoints (builds, depot
 * manifest, chunks) are fetch stubs, so nothing here touches the network. The
 * point of these tests is the decode/verify boundary — GOG gives us MD5s and
 * deflate-compressed chunks, the depot stores SHA-256 chunks, and a release
 * must never be published unless every chunk verified.
 */

const md5 = (bytes: Buffer) => createHash('md5').update(bytes).digest('hex')
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** A depot chunk stub plus the exact bytes the CDN serves for it. */
type ChunkStub = {
  md5: string
  compressedMd5: string
  size: number
  compressedSize: number
  served: Buffer
}

/** Stored (uncompressed) chunk: the CDN key is the MD5 of the bytes themselves. */
function storedChunk(bytes: Buffer): ChunkStub {
  return {
    md5: md5(bytes),
    compressedMd5: md5(bytes),
    size: bytes.length,
    compressedSize: bytes.length,
    served: bytes,
  }
}

/** Deflate chunk: the CDN key is the MD5 of the *compressed* payload. */
function deflateChunk(bytes: Buffer): ChunkStub {
  const compressed = deflateRawSync(bytes)
  return {
    md5: md5(bytes),
    compressedMd5: md5(compressed),
    size: bytes.length,
    compressedSize: compressed.length,
    served: compressed,
  }
}

const originalFetch = globalThis.fetch

/** Route stubs; an unmatched URL fails the test loudly instead of reaching out. */
function stubFetch(routes: Array<{ match: RegExp; respond: (url: string) => Response }>) {
  const requested: string[] = []
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input)
    requested.push(url)
    const route = routes.find((r) => r.match.test(url))
    if (!route) throw new Error(`Unexpected network request in test: ${url}`)
    return route.respond(url)
  }) as typeof fetch
  return requested
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** Serves a chunk by its CDN key (compressedMd5); unknown keys 404. */
function chunkRoutes(chunks: ChunkStub[]) {
  return [
    {
      match: /\/chunks\//,
      respond: (url: string) => {
        const key = url.split('/').pop()!
        const chunk = chunks.find((c) => c.compressedMd5 === key)
        return chunk ? binaryResponse(chunk.served) : new Response('gone', { status: 404 })
      },
    },
  ]
}

const MANIFEST_HASH = 'aabbccddeeff00112233445566778899'

function buildsRoute(builds: GogBuildDetails[]) {
  return { match: /\/builds/, respond: () => jsonResponse({ items: builds }) }
}

const ONE_BUILD: GogBuildDetails[] = [
  {
    buildId: 'build-1',
    productId: '1207658776',
    versionName: '1.0.0',
    depots: [{ id: 'depot-1', manifest: MANIFEST_HASH }],
  },
]

function manifestRoute(files: GogManifestFile[]) {
  return {
    match: /\/manifests\//,
    respond: () =>
      jsonResponse({
        depotId: 'depot-1',
        manifestId: MANIFEST_HASH,
        totalSize: files.reduce((n, f) => n + f.size, 0),
        files,
      }),
  }
}

function makeStore() {
  const updates: Array<Record<string, unknown>> = []
  const store: StreamJobStore = {
    async update(input) {
      updates.push(input as unknown as Record<string, unknown>)
    },
  }
  return { store, updates }
}

async function depotRoot() {
  const root = await mkdtemp(join(tmpdir(), 'gamedepot-gog-'))
  return { root, path: join(root, 'depot') }
}

/** Nothing may be published on a failed acquisition: the manifests dir stays
 * absent or empty. */
async function publishedManifests(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

test('streamGogGameToDepot publishes a release from stored and deflate chunks', async () => {
  const { root, path } = await depotRoot()
  const plain = Buffer.from('gog-stored-chunk-content'.repeat(4))
  const zipped = Buffer.from('deflated-chunk-payload'.repeat(8))
  const stored = storedChunk(plain)
  const deflated = deflateChunk(zipped)

  const files: GogManifestFile[] = [
    { path: 'game/data.bin', size: plain.length, md5: stored.md5, chunks: [stored] },
    { path: 'game/text.dat', size: zipped.length, md5: deflated.md5, chunks: [deflated] },
  ]
  stubFetch([buildsRoute(ONE_BUILD), manifestRoute(files), ...chunkRoutes([stored, deflated])])

  const { store, updates } = makeStore()
  const manifestPath = await streamGogGameToDepot({
    jobId: 'job-1',
    productId: '1207658776',
    accessToken: 'token',
    depotRoot: path,
    store,
  })

  const published = await readDropletManifest(manifestPath)
  assert.equal(published.format, 'gamedepot-droplet')
  const byPath = new Map(published.files.map((f) => [f.path, f]))
  assert.equal(byPath.get('game/data.bin')!.sha256, sha256(plain))
  assert.equal(byPath.get('game/text.dat')!.sha256, sha256(zipped))
  assert.equal(byPath.get('game/text.dat')!.size, zipped.length)

  assert.equal(updates.at(-1)!.status, 'COMPLETED')
  assert.equal(updates.at(-1)!.progress, 100)
  assert.equal(updates.at(-1)!.manifestPath, manifestPath)

  // Every chunk the manifest points at must really exist and digest to its key.
  for (const [sha, entry] of Object.entries(published.chunkIndex)) {
    const stored = await readFile(join(path, entry.object))
    assert.equal(sha256(stored), sha, `CAS object ${entry.object} must match its key`)
    assert.equal(stored.length, entry.size)
  }

  await rm(root, { recursive: true, force: true })
})

test('streamGogGameToDepot concatenates provider chunks in manifest order', async () => {
  const { root, path } = await depotRoot()
  const a = Buffer.from('A'.repeat(70000))
  const b = Buffer.from('B'.repeat(30000))
  const ca = storedChunk(a)
  const cb = storedChunk(b)

  const files: GogManifestFile[] = [
    {
      path: 'game/big.pak',
      size: a.length + b.length,
      md5: md5(Buffer.concat([a, b])),
      chunks: [ca, cb],
    },
  ]
  stubFetch([buildsRoute(ONE_BUILD), manifestRoute(files), ...chunkRoutes([ca, cb])])

  const { store } = makeStore()
  const manifestPath = await streamGogGameToDepot({
    jobId: 'job-multi',
    productId: 'p',
    accessToken: 'token',
    depotRoot: path,
    store,
  })

  const published = await readDropletManifest(manifestPath)
  assert.equal(published.files[0].sha256, sha256(Buffer.concat([a, b])))
  assert.equal(published.files[0].size, a.length + b.length)
  // Depot chunking follows DEPOT_CHUNK_SIZE, not GOG's chunk boundaries: two
  // provider chunks under 4 MiB reassemble into one whole file and one CAS chunk.
  assert.equal(published.files[0].chunks.length, 1)
  assert.equal(published.files[0].chunks[0].size, a.length + b.length)

  await rm(root, { recursive: true, force: true })
})

test('streamGogGameToDepot fails closed on a chunk MD5 mismatch and publishes nothing', async () => {
  const { root, path } = await depotRoot()
  const good = Buffer.from('AAAA')
  // Same declared length, different bytes served: only an MD5 check can catch it.
  const corrupt = { ...storedChunk(Buffer.from('BBBB')), md5: md5(good), size: good.length }

  const files: GogManifestFile[] = [{ path: 'bad.bin', size: good.length, md5: md5(good), chunks: [corrupt] }]
  stubFetch([buildsRoute(ONE_BUILD), manifestRoute(files), ...chunkRoutes([corrupt])])

  const { store, updates } = makeStore()
  await assert.rejects(
    streamGogGameToDepot({ jobId: 'job-bad', productId: 'p', accessToken: 'token', depotRoot: path, store }),
    /MD5 mismatch/
  )

  assert.equal(updates.at(-1)!.status, 'FAILED')
  assert.match(String(updates.at(-1)!.error), /MD5 mismatch/)
  assert.deepEqual(await publishedManifests(join(path, 'manifests')), [], 'no manifest may be published')

  await rm(root, { recursive: true, force: true })
})

test('streamGogGameToDepot fails closed when chunks cannot satisfy the declared size', async () => {
  const { root, path } = await depotRoot()
  const body = Buffer.from('short')
  const chunk = storedChunk(body)

  // The manifest declares 500 bytes; the chunk list only carries 5.
  const files: GogManifestFile[] = [{ path: 'lying.bin', size: 500, md5: chunk.md5, chunks: [chunk] }]
  stubFetch([buildsRoute(ONE_BUILD), manifestRoute(files), ...chunkRoutes([chunk])])

  const { store, updates } = makeStore()
  await assert.rejects(
    streamGogGameToDepot({ jobId: 'job-size', productId: 'p', accessToken: 'token', depotRoot: path, store }),
    /length mismatch/
  )
  assert.equal(updates.at(-1)!.status, 'FAILED')
  assert.deepEqual(await publishedManifests(join(path, 'manifests')), [])

  await rm(root, { recursive: true, force: true })
})

test('streamGogGameToDepot reports typed 404s for a missing build or depot manifest', async () => {
  const { root, path } = await depotRoot()
  const { store, updates } = makeStore()

  stubFetch([buildsRoute([])])
  await assert.rejects(
    streamGogGameToDepot({ jobId: 'job-empty', productId: 'p', accessToken: 'token', depotRoot: path, store }),
    typedError(404, /No GOG build/)
  )
  assert.equal(updates.at(-1)!.status, 'FAILED')

  stubFetch([buildsRoute([{ buildId: 'b', productId: 'p', depots: [{ id: 'd' }] }])])
  await assert.rejects(
    streamGogGameToDepot({ jobId: 'job-none', productId: 'p', accessToken: 'token', depotRoot: path, store }),
    typedError(404, /no depot manifest/)
  )

  stubFetch([
    buildsRoute(ONE_BUILD),
    {
      match: /\/manifests\//,
      respond: () => jsonResponse({ depotId: 'd', manifestId: MANIFEST_HASH, totalSize: 0, files: [] }),
    },
  ])
  await assert.rejects(
    streamGogGameToDepot({ jobId: 'job-nofiles', productId: 'p', accessToken: 'token', depotRoot: path, store }),
    typedError(404, /No files found/)
  )

  await rm(root, { recursive: true, force: true })
})

test('streamGogGameToDepot refuses duplicate paths before transferring anything', async () => {
  const { root, path } = await depotRoot()
  const chunk = storedChunk(Buffer.from('x'))

  const files: GogManifestFile[] = [
    { path: 'dup.bin', size: 1, md5: chunk.md5, chunks: [chunk] },
    { path: 'dup.bin', size: 1, md5: chunk.md5, chunks: [chunk] },
  ]
  const requested = stubFetch([buildsRoute(ONE_BUILD), manifestRoute(files), ...chunkRoutes([chunk])])

  await assert.rejects(
    streamGogGameToDepot({ jobId: 'job-dup', productId: 'p', accessToken: 'token', depotRoot: path }),
    typedError(502, /Duplicate GOG file path/)
  )
  assert.equal(
    requested.some((u) => u.includes('/chunks/')),
    false,
    'a rejected release must not download anything'
  )

  await rm(root, { recursive: true, force: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
})
