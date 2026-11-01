import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupPartSets, resolvePartSets, verifyPartSet, type PartSet } from './discset'

const set = (base: string, kind: PartSet['kind'], parts: [string, number][]): PartSet => ({
  base,
  kind,
  parts: parts.map(([name, index]) => ({ name, index })),
})

test('groups .7z.001 chains and orders parts', () => {
  const sets = groupPartSets(['Game.7z.003', 'Game.7z.001', 'Game.7z.002'])
  assert.equal(sets.length, 1)
  assert.equal(sets[0]!.kind, '7z')
  assert.deepEqual(sets[0]!.parts.map((p) => p.name), ['Game.7z.001', 'Game.7z.002', 'Game.7z.003'])
  assert.equal(sets[0]!.base, 'game.7z')
})

test('groups .partN.rar chains across numbering widths', () => {
  const sets = groupPartSets(['g.part2.rar', 'g.part10.rar', 'g.part1.rar'])
  assert.equal(sets.length, 1)
  assert.deepEqual(sets[0]!.parts.map((p) => p.index), [1, 2, 10])
})

test('groups legacy .rar + .rNN sets with base at index 0', () => {
  const sets = groupPartSets(['movie.rar', 'movie.r00', 'movie.r01'])
  assert.equal(sets.length, 1)
  assert.deepEqual(sets[0]!.parts.map((p) => p.index), [0, 1, 2])
})

test('generic .001 splits group separately from .7z chains', () => {
  const sets = groupPartSets(['data.zip.001', 'data.zip.002'])
  assert.equal(sets.length, 1)
  assert.equal(sets[0]!.kind, 'generic-split')
})

test('unrelated filenames are ignored, not grouped', () => {
  const sets = groupPartSets(['readme.txt', 'setup.exe', 'patch.vdf'])
  assert.equal(sets.length, 0)
})

test('different bases never collide, even with same part numbers', () => {
  const sets = groupPartSets(['a.7z.001', 'b.7z.001'])
  assert.equal(sets.length, 2)
})

test('verifyPartSet accepts contiguous 1-based sets', () => {
  assert.doesNotThrow(() => verifyPartSet(set('g.7z', '7z', [['g.7z.001', 1], ['g.7z.002', 2]])))
  assert.doesNotThrow(() => verifyPartSet(set('m', 'rar-rNN', [['m.rar', 0], ['m.r00', 1]])))
})

test('verifyPartSet fails closed on gaps', () => {
  assert.throws(() => verifyPartSet(set('g.7z', '7z', [['g.7z.001', 1], ['g.7z.003', 3]])), /gap before part 3/)
})

test('verifyPartSet fails closed on missing first/base part', () => {
  assert.throws(() => verifyPartSet(set('g.7z', '7z', [['g.7z.002', 2]])), /missing/)
  assert.throws(() => verifyPartSet(set('m', 'rar-rNN', [['m.r00', 1]])), /base/)
})

test('resolvePartSet end-to-end: complete set resolves, incomplete set rejects', () => {
  const sets = resolvePartSets(['d.7z.002', 'd.7z.001'])
  assert.deepEqual(sets[0]!.parts.map((p) => p.name), ['d.7z.001', 'd.7z.002'])
  assert.throws(() => resolvePartSets(['d.7z.001', 'd.7z.004']), /gap before part 4/)
})

test('duplicate part indices for the same base fail closed', () => {
  assert.throws(
    () => groupPartSets(['a.7z.001', 'a.7z.001']),
    /Conflicting duplicate part 1/
  )
})