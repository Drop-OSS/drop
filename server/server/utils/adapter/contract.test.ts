import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDropletManifest } from '../../depot/manifest'
import { stageAdapterRelease, safeLogicalPath, type AdapterFile } from './contract'

const chunk = (n: number) => Buffer.alloc(n, 7)

async function dirs() {
  const root = await mkdtemp(join(tmpdir(), 'gamedepot-adapter-'))
  return { root, objectsDir: join(root, 'objects'), manifestsDir: join(root, 'manifests') }
}

function acquireBytes(bytes: Buffer) {
  return async function* (_file: AdapterFile) {
    for (let i = 0; i < bytes.length; i += 100) yield bytes.subarray(i, i + 100)
  }
}

const baseFile: AdapterFile = { fileId: 'f1', path: 'game/bin/data.pak', size: 250 }

test('stageAdapterRelease streams, verifies and publishes a manifest', async () => {
  const { objectsDir, manifestsDir } = await dirs()
  const bytes = chunk(250)
  const { manifest, manifestPath, files } = await stageAdapterRelease({
    gameTitle: 'Test Game',
    files: [{ ...baseFile, sha256: Buffer.from(bytes.toString('hex')).toString() }],
    objectsDir,
    manifestsDir,
    acquire: acquireBytes(bytes),
  })
  assert.equal(files.length, 1)
  assert.equal(files[0].size, 250)
  assert.equal(manifest.format, 'gamedepot-droplet')
  assert.ok(manifest.files.some((f) => f.path === 'game/bin/data.pak'))
  // Manifest is readable back and digest-validates.
  const round = await readDropletManifest(manifestPath)
  assert.equal(round.digest, manifest.digest)
  // Raw chunk objects exist under the CAS layout.
  const [a, b] = await readdir(objectsDir)
  assert.ok([a, b].includes(files[0].chunks[0]!.sha256.slice(0, 2)))
})

test('declared size mismatch fails closed and publishes nothing', async () => {
  const { objectsDir, manifestsDir } = await dirs()
  await assert.rejects(
    stageAdapterRelease({
      gameTitle: 'T',
      files: [{ ...baseFile, size: 999 }],
      objectsDir,
      manifestsDir,
      acquire: acquireBytes(chunk(250)),
    }),
    /length mismatch/
  )
  await assert.rejects(readdir(manifestsDir), /ENOENT/)
})

test('declared digest mismatch fails closed', async () => {
  const { objectsDir, manifestsDir } = await dirs()
  await assert.rejects(
    stageAdapterRelease({
      gameTitle: 'T',
      files: [{ ...baseFile, sha256: '0'.repeat(64) }],
      objectsDir,
      manifestsDir,
      acquire: acquireBytes(chunk(250)),
    }),
    /digest mismatch/
  )
})

test('duplicate logical paths are rejected before transfer', async () => {
  const { objectsDir, manifestsDir } = await dirs()
  let transfers = 0
  await assert.rejects(
    stageAdapterRelease({
      gameTitle: 'T',
      files: [
        { fileId: 'a', path: 'x/y.txt', size: 1 },
        { fileId: 'b', path: 'x\\y.txt', size: 1 },
      ],
      objectsDir,
      manifestsDir,
      acquire: async (f) => {
        transfers += 1
        return acquireBytes(chunk(1))(f)
      },
    }),
    /Duplicate adapter file path/
  )
  assert.equal(transfers, 0)
})

test('abort signal fails the ingestion before publishing', async () => {
  const { objectsDir, manifestsDir } = await dirs()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    stageAdapterRelease({
      gameTitle: 'T',
      files: [{ ...baseFile }],
      objectsDir,
      manifestsDir,
      signal: controller.signal,
      acquire: acquireBytes(chunk(250)),
    }),
    /aborted/
  )
  await assert.rejects(readdir(manifestsDir), /ENOENT/)
})

test('empty files stage with the empty digest and no chunks', async () => {
  const { objectsDir, manifestsDir } = await dirs()
  const { files } = await stageAdapterRelease({
    gameTitle: 'T',
    files: [{ fileId: 'e', path: 'game/empty.cfg', size: 0 }],
    objectsDir,
    manifestsDir,
    acquire: async () => {
      throw new Error('must not be called')
    },
  })
  assert.equal(files[0]!.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.equal(files[0]!.chunks.length, 0)
})

test('safeLogicalPath rejects traversal, absolute and drive paths', () => {
  for (const bad of ['../escape', '/abs', 'C:\\win', 'a/../b', '']) {
    assert.throws(() => safeLogicalPath(bad), /Unsafe/)
  }
  assert.equal(safeLogicalPath('game\\bin\\data.pak'), 'game/bin/data.pak')
})