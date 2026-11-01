import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { crc32, parseZipDirectory } from './zip-manifest'

function makeZip(name: string, content: Buffer): Buffer {
  const filename = Buffer.from(name)
  const compressed = deflateRawSync(content)
  const checksum = crc32(content)
  const local = Buffer.alloc(30 + filename.length)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6)
  local.writeUInt16LE(8, 8); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(content.length, 22); local.writeUInt16LE(filename.length, 26); filename.copy(local, 30)
  const data = Buffer.concat([local, compressed])
  const central = Buffer.alloc(46 + filename.length)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(checksum, 16)
  central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(0, 42); filename.copy(central, 46)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(data.length, 16)
  return Buffer.concat([data, central, eocd])
}

test('parses a small ZIP central directory fixture', () => {
  const zip = makeZip('game/data.bin', Buffer.from('EA fixture contents'))
  const tail = zip.subarray(Math.max(0, zip.length - (22 + 0xffff)))
  const start = zip.length - tail.length
  const parsed = parseZipDirectory(tail, start, zip.length)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].name, 'game/data.bin')
  assert.equal(parsed[0].compressionMethod, 8)
  assert.equal(parsed[0].uncompressedSize, 19)
  assert.equal(parsed[0].localHeaderOffset, 0)
})

test('CRC32 detects corrupted uncompressed content', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926)
  assert.notEqual(crc32(Buffer.from('123456788')), 0xcbf43926)
})

test('rejects a malformed central directory signature', () => {
  const zip = makeZip('x', Buffer.from('x'))
  const corrupted = Buffer.from(zip)
  const directoryOffset = corrupted.readUInt32LE(corrupted.length - 22 + 16)
  corrupted.writeUInt32LE(0, directoryOffset)
  const tail = corrupted.subarray(Math.max(0, corrupted.length - (22 + 0xffff)))
  assert.throws(() => parseZipDirectory(tail, corrupted.length - tail.length, corrupted.length), { statusCode: 502 })
})
