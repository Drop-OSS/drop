import { createError } from 'h3'

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50
const MAX_EOCD_SEARCH = 22 + 0xffff, MAX_DIRECTORY_SIZE = 64 * 1024 * 1024, MAX_ENTRIES = 100_000
export type EaZipEntry = { name: string; flags: number; compressionMethod: number; crc32: number; compressedSize: number; uncompressedSize: number; localHeaderOffset: number }
function malformed(message: string): never { throw createError({ statusCode: 502, statusMessage: `Malformed EA ZIP archive: ${message}` }) }
function findEocd(b: Buffer): number {
  for (let i = b.length - 22; i >= Math.max(0, b.length - MAX_EOCD_SEARCH); i--) if (b.readUInt32LE(i) === EOCD && i + 22 + b.readUInt16LE(i + 20) === b.length) return i
  return malformed('end-of-central-directory record not found')
}
export function parseZipDirectory(data: Buffer, absoluteStart: number, archiveSize: number): EaZipEntry[] {
  const e = findEocd(data), disk = data.readUInt16LE(e + 4), dirDisk = data.readUInt16LE(e + 6)
  const diskCount = data.readUInt16LE(e + 8), count = data.readUInt16LE(e + 10), size = data.readUInt32LE(e + 12), offset = data.readUInt32LE(e + 16)
  if (disk || dirDisk || diskCount !== count) malformed('multi-disk ZIP files are unsupported')
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) malformed('ZIP64 archives are unsupported')
  if (count > MAX_ENTRIES || size > MAX_DIRECTORY_SIZE) malformed('central directory exceeds parser limits')
  if (offset + size > absoluteStart + e || offset + size > archiveSize) malformed('central directory bounds are invalid')
  let p = offset - absoluteStart
  const end = p + size
  if (p < 0 || end > e) malformed('central directory is not present in fetched range')
  const result: EaZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || data.readUInt32LE(p) !== CENTRAL) malformed('invalid central directory signature')
    const flags = data.readUInt16LE(p + 8), compressionMethod = data.readUInt16LE(p + 10), crc = data.readUInt32LE(p + 16)
    const compressedSize = data.readUInt32LE(p + 20), uncompressedSize = data.readUInt32LE(p + 24)
    const nameLength = data.readUInt16LE(p + 28), extraLength = data.readUInt16LE(p + 30), commentLength = data.readUInt16LE(p + 32)
    const startDisk = data.readUInt16LE(p + 34), localHeaderOffset = data.readUInt32LE(p + 42), recordEnd = p + 46 + nameLength + extraLength + commentLength
    if (recordEnd > end) malformed('directory entry exceeds central directory bounds')
    if (startDisk || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) malformed('multi-disk or ZIP64 entry unsupported')
    if (compressionMethod !== 0 && compressionMethod !== 8) malformed(`unsupported compression method ${compressionMethod}`)
    if (flags & 1) malformed('encrypted entries unsupported')
    let name: string
    try { name = new TextDecoder(flags & 0x0800 ? 'utf-8' : 'windows-1252', { fatal: true }).decode(data.subarray(p + 46, p + 46 + nameLength)) }
    catch { malformed('invalid filename encoding') }
    if (!name || name.includes('\0') || localHeaderOffset + 30 > archiveSize) malformed('invalid entry name or local header offset')
    result.push({ name, flags, compressionMethod, crc32: crc, compressedSize, uncompressedSize, localHeaderOffset })
    p = recordEnd
  }
  if (p !== end) malformed('central directory size does not match entries')
  return result
}
export async function fetchZipRange(url: string, start: number, end: number, signal?: AbortSignal): Promise<Buffer> {
  if (!/^https:\/\//i.test(url)) throw createError({ statusCode: 400, statusMessage: 'EA archive URL must use HTTPS' })
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) malformed('invalid byte range')
  let r: Response
  try { r = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, Accept: 'application/zip, application/octet-stream' }, signal: signal ?? AbortSignal.timeout(30_000) }) }
  catch { throw createError({ statusCode: 502, statusMessage: 'Failed to fetch EA ZIP byte range' }) }
  if (r.status !== 206 || !r.headers.get('content-range')?.startsWith(`bytes ${start}-${end}/`)) malformed('server failed to honor requested byte range')
  const b = Buffer.from(await r.arrayBuffer())
  if (b.length !== end - start + 1) malformed('range response length mismatch')
  return b
}
/** Fetch the trailer and directory separately. Total allocation is capped at 64 MiB plus ZIP trailer. */
export async function fetchEaZipEntries(url: string, signal?: AbortSignal): Promise<EaZipEntry[]> {
  let head: Response
  try { head = await fetch(url, { method: 'HEAD', signal: signal ?? AbortSignal.timeout(15_000) }) }
  catch { throw createError({ statusCode: 502, statusMessage: 'Failed to inspect EA ZIP archive' }) }
  const archiveSize = Number(head.headers.get('content-length'))
  if (!head.ok || !Number.isSafeInteger(archiveSize) || archiveSize < 22) throw createError({ statusCode: 502, statusMessage: 'EA ZIP requires a valid Content-Length' })
  const tailStart = Math.max(0, archiveSize - MAX_EOCD_SEARCH)
  const tail = await fetchZipRange(url, tailStart, archiveSize - 1, signal)
  const e = findEocd(tail), dirSize = tail.readUInt32LE(e + 12), dirOffset = tail.readUInt32LE(e + 16)
  if (dirSize > MAX_DIRECTORY_SIZE || dirOffset + dirSize > archiveSize) malformed('central directory exceeds limits')
  const dir = dirSize ? await fetchZipRange(url, dirOffset, dirOffset + dirSize - 1, signal) : Buffer.alloc(0)
  return parseZipDirectory(Buffer.concat([dir, tail.subarray(e)]), dirOffset, archiveSize)
}
export async function fetchEaZipEntryData(url: string, entry: EaZipEntry, signal?: AbortSignal): Promise<{ offset: number }> {
  const h = await fetchZipRange(url, entry.localHeaderOffset, entry.localHeaderOffset + 29, signal)
  if (h.readUInt32LE(0) !== LOCAL) malformed(`invalid local header for ${entry.name}`)
  const n = h.readUInt16LE(26), x = h.readUInt16LE(28), variableLength = n + x
  if (variableLength > 128 * 1024) malformed('excessive local header length')
  const variable = variableLength ? await fetchZipRange(url, entry.localHeaderOffset + 30, entry.localHeaderOffset + 29 + variableLength, signal) : Buffer.alloc(0)
  let expected: Buffer
  try { expected = Buffer.from(entry.name, entry.flags & 0x0800 ? 'utf8' : 'latin1') } catch { malformed('invalid local filename') }
  if (!variable.subarray(0, n).equals(expected) || h.readUInt16LE(8) !== entry.compressionMethod) malformed(`local header disagrees with directory for ${entry.name}`)
  return { offset: entry.localHeaderOffset + 30 + variableLength }
}
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
export function crc32Update(crc: number, bytes: Uint8Array): number { let c = crc ^ 0xffffffff; for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
export function crc32(bytes: Uint8Array): number { return crc32Update(0, bytes) }
