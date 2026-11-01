import { createError } from 'h3'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const MAX_EOCD_SEARCH = 22 + 0xffff
const MAX_DIRECTORY_SIZE = 64 * 1024 * 1024
const MAX_ENTRIES = 100_000

export type EaZipEntry = {
  name: string
  flags: number
  compressionMethod: number
  crc32: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

function malformed(message: string): never {
  throw createError({ statusCode: 502, statusMessage: `Malformed EA ZIP archive: ${message}` })
}

/** Parse a fetched tail containing an EOCD record and its central directory. */
export function parseZipDirectory(tail: Buffer, absoluteStart: number, archiveSize: number): EaZipEntry[] {
  let eocd = -1
  const min = Math.max(0, tail.length - MAX_EOCD_SEARCH)
  for (let i = tail.length - 22; i >= min; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
      const commentLength = tail.readUInt16LE(i + 20)
      if (i + 22 + commentLength === tail.length) { eocd = i; break }
    }
  }
  if (eocd < 0) malformed('end-of-central-directory record not found')
  const disk = tail.readUInt16LE(eocd + 4)
  const directoryDisk = tail.readUInt16LE(eocd + 6)
  const diskEntries = tail.readUInt16LE(eocd + 8)
  const entriesCount = tail.readUInt16LE(eocd + 10)
  const directorySize = tail.readUInt32LE(eocd + 12)
  const directoryOffset = tail.readUInt32LE(eocd + 16)
  if (disk !== 0 || directoryDisk !== 0 || diskEntries !== entriesCount) malformed('multi-disk ZIP files are unsupported')
  if (entriesCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) malformed('ZIP64 archives are unsupported')
  if (entriesCount > MAX_ENTRIES || directorySize > MAX_DIRECTORY_SIZE) malformed('central directory exceeds parser limits')
  const eocdAbsolute = absoluteStart + eocd
  if (directoryOffset + directorySize > eocdAbsolute || directoryOffset + directorySize > archiveSize) malformed('central directory bounds are invalid')
  const directoryIndex = directoryOffset - absoluteStart
  if (directoryIndex < 0 || directoryIndex + directorySize > tail.length) malformed('central directory is not present in fetched range')

  const entries: EaZipEntry[] = []
  let cursor = directoryIndex
  const end = directoryIndex + directorySize
  for (let n = 0; n < entriesCount; n++) {
    if (cursor + 46 > end || tail.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) malformed('invalid central directory entry signature')
    const flags = tail.readUInt16LE(cursor + 8)
    const compressionMethod = tail.readUInt16LE(cursor + 10)
    const crc = tail.readUInt32LE(cursor + 16)
    const compressedSize = tail.readUInt32LE(cursor + 20)
    const uncompressedSize = tail.readUInt32LE(cursor + 24)
    const nameLength = tail.readUInt16LE(cursor + 28)
    const extraLength = tail.readUInt16LE(cursor + 30)
    const commentLength = tail.readUInt16LE(cursor + 32)
    const startDisk = tail.readUInt16LE(cursor + 34)
    const localHeaderOffset = tail.readUInt32LE(cursor + 42)
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength
    if (recordEnd > end) malformed('central directory entry extends beyond directory bounds')
    if (startDisk !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) malformed('multi-disk or ZIP64 entry is unsupported')
    if (compressionMethod !== 0 && compressionMethod !== 8) malformed(`unsupported compression method ${compressionMethod}`)
    if (flags & 0x0001) malformed('encrypted ZIP entries are unsupported')
    const filename = tail.subarray(cursor + 46, cursor + 46 + nameLength)
    let name: string
    try { name = new TextDecoder(flags & 0x0800 ? 'utf-8' : 'windows-1252', { fatal: true }).decode(filename) }
    catch { malformed('entry name has invalid encoding') }
    if (!name || name.includes('\0')) malformed('entry has an empty or invalid name')
    if (localHeaderOffset + 30 > archiveSize) malformed(`local header offset out of bounds for ${name}`)
    entries.push({ name, flags, compressionMethod, crc32: crc, compressedSize, uncompressedSize, localHeaderOffset })
    cursor = recordEnd
  }
  if (cursor !== end) malformed('central directory size does not match its entries')
  return entries
}

/** Fetch exactly a byte range, rejecting servers that ignore or alter Range. */
export async function fetchZipRange(url: string, start: number, endInclusive: number, signal?: AbortSignal): Promise<Buffer> {
  if (!/^https:\/\//i.test(url)) throw createError({ statusCode: 400, statusMessage: 'EA archive URL must use HTTPS' })
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(endInclusive) || start < 0 || endInclusive < start) malformed('invalid requested byte range')
  let response: Response
  try {
    response = await fetch(url, { headers: { Range: `bytes=${start}-${endInclusive}`, Accept: 'application/zip, application/octet-stream;q=0.9, */*;q=0.1' }, signal: signal ?? AbortSignal.timeout(30_000) })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch EA ZIP byte range' })
  }
  if (response.status !== 206) throw createError({ statusCode: 502, statusMessage: `EA ZIP server did not honor byte range (${response.status})` })
  const contentRange = response.headers.get('content-range')
  const expected = `bytes ${start}-${endInclusive}/`
  if (!contentRange?.startsWith(expected)) malformed('server returned an unexpected Content-Range')
  const data = Buffer.from(await response.arrayBuffer())
  if (data.length !== endInclusive - start + 1) malformed('range response length mismatch')
  return data
}

/** Resolve the archive size, then fetch only EOCD + central-directory bytes. */
export async function fetchEaZipEntries(url: string, signal?: AbortSignal): Promise<EaZipEntry[]> {
  const tailStartHint = 0
  let response: Response
  try {
    response = await fetch(url, { method: 'HEAD', headers: { Accept: 'application/zip, application/octet-stream' }, signal: signal ?? AbortSignal.timeout(15_000) })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to inspect EA ZIP archive' })
  }
  const rawLength = response.headers.get('content-length')
  const archiveSize = rawLength ? Number(rawLength) : NaN
  if (!response.ok || !Number.isSafeInteger(archiveSize) || archiveSize < 22) {
    throw createError({ statusCode: 502, statusMessage: 'EA ZIP archive must provide a valid Content-Length' })
  }
  const tailLength = Math.min(archiveSize, MAX_EOCD_SEARCH)
  const start = archiveSize - tailLength
  const tail = await fetchZipRange(url, start, archiveSize - 1, signal)
  // Avoid buffering archive data: this range contains only the ZIP trailer and directory.
  void tailStartHint
  return parseZipDirectory(tail, start, archiveSize)
}

export async function fetchEaZipEntryData(url: string, entry: EaZipEntry, signal?: AbortSignal): Promise<{ data: Response; offset: number }> {
  const header = await fetchZipRange(url, entry.localHeaderOffset, entry.localHeaderOffset + 29, signal)
  if (header.readUInt32LE(0) !== LOCAL_SIGNATURE) malformed(`invalid local file header for ${entry.name}`)
  const nameLength = header.readUInt16LE(26)
  const extraLength = header.readUInt16LE(28)
  const variableLength = nameLength + extraLength
  if (variableLength > 128 * 1024) malformed(`excessive local header size for ${entry.name}`)
  const variable = variableLength ? await fetchZipRange(url, entry.localHeaderOffset + 30, entry.localHeaderOffset + 29 + variableLength, signal) : Buffer.alloc(0)
  const localName = variable.subarray(0, nameLength)
  const expectedName = Buffer.from(entry.name, entry.flags & 0x0800 ? 'utf8' : 'latin1')
  if (!localName.equals(expectedName)) malformed(`local and central names differ for ${entry.name}`)
  return { data: new Response(null), offset: entry.localHeaderOffset + 30 + variableLength }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32Update(crc: number, bytes: Uint8Array): number {
  let value = crc ^ 0xffffffff
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

export function crc32(bytes: Uint8Array): number { return crc32Update(0, bytes) }
