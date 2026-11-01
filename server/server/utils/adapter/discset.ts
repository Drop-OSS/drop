import { createError } from 'h3'

/**
 * Installer / disc-set support: group split-archive and multi-part installer
 * files (.7z.001 chains, .partN.rar chains, legacy .rar+.rNN sets, generic
 * .001/.002 splits) into ordered logical releases, and verify completeness
 * (all required parts present, contiguous, unambiguous) before acquisition.
 *
 * Pure filename analysis: no I/O, no network, trivially hermetic to test.
 * Adapters feed part filenames in and get an ordered, gap-checked release
 * structure out, preserving original filenames as provenance.
 */

export type PartKind = '7z' | 'rar-partN' | 'rar-rNN' | 'generic-split'

export interface PartSetPart {
  /** Original filename; retained as source provenance. */
  name: string
  /** 1-based position within the set (0 for the base .rar of a legacy split). */
  index: number
}

export interface PartSet {
  /** Shared stem of the set (e.g. `game.7z`, `game.part1.rar` style stem). */
  base: string
  kind: PartKind
  parts: PartSetPart[]
}

const LOWER = (s: string) => s.toLowerCase()

/** Match one filename against every supported split-archive naming scheme. */
function matchPart(name: string): { base: string; kind: PartKind; index: number } | null {
  // game.7z.001 / game.7z.002 ...
  const sevenZip = /^(.+\.7z)\.(\d{3})$/i.exec(name)
  if (sevenZip) return { base: LOWER(sevenZip[1]), kind: '7z', index: Number(sevenZip[2]) }
  if (/\.7z$/i.test(name)) return { base: LOWER(name), kind: '7z', index: 0 }
  // game.part1.rar / game.part12.rar ... (sfx archives use .exe chains: same shape)
  const rarPart = /^(.+)\.part(\d+)\.(rar|exe)$/i.exec(name)
  if (rarPart) return { base: LOWER(rarPart[1]), kind: 'rar-partN', index: Number(rarPart[2]) }
  // game.rar + game.r00 / game.r01 ... (legacy RAR split)
  const legacyRar = /^(.+)\.r(\d{2,})$/i.exec(name)
  if (legacyRar) return { base: LOWER(legacyRar[1]), kind: 'rar-rNN', index: Number(legacyRar[2]) + 1 }
  if (/\.rar$/i.test(name)) return { base: LOWER(name), kind: 'rar-rNN', index: 0 }
  // game.zip.001 / game.001 ... (generic split)
  const generic = /^(.+)\.(\d{3})$/i.exec(name)
  if (generic) return { base: LOWER(generic[1]), kind: 'generic-split', index: Number(generic[2]) }
  return null
}

/** Group filenames into logical part sets. Unmatched filenames are ignored. */
export function groupPartSets(names: string[]): PartSet[] {
  const groups = new Map<string, PartSet & { indexes: Set<number> }>()
  for (const name of names) {
    const match = matchPart(name)
    if (!match) continue
    const key = `${match.kind}:${match.base}`
    let group = groups.get(key)
    if (!group) {
      group = { base: match.base, kind: match.kind, parts: [], indexes: new Set<number>() }
      groups.set(key, group)
    }
    if (group.indexes.has(match.index)) {
      throw createError({
        statusCode: 502,
        statusMessage: `Conflicting duplicate part ${match.index} in part set ${match.base}`,
      })
    }
    group.indexes.add(match.index)
    group.parts.push({ name, index: match.index })
  }
  const sets = [...groups.values()].map(({ indexes, ...set }) => {
    set.parts.sort((a, b) => a.index - b.index)
    return { ...set, parts: set.parts }
  })
  // Deterministic output order for stable manifests.
  return sets.sort((a, b) => (a.base === b.base ? a.kind.localeCompare(b.kind) : a.base.localeCompare(b.base, 'en')))
}

/**
 * Verify a part set is complete and ordered before acquisition:
 * - legacy .rar sets start at index 0 (the .rar file) and continue 1..N;
 * - every other kind starts at index 1;
 * - indices must be contiguous with no gaps.
 */
export function verifyPartSet(set: PartSet): PartSet {
  const first = set.kind === 'rar-rNN' ? 0 : 1
  const indexes = set.parts.map((p) => p.index)
  if (indexes.length === 0) {
    throw createError({ statusCode: 502, statusMessage: `Empty part set ${set.base}` })
  }
  if (indexes[0] !== first) {
    throw createError({
      statusCode: 502,
      statusMessage: `Part set ${set.base} is missing its ${first === 0 ? 'base .rar' : 'first'} file`,
    })
  }
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] !== indexes[i - 1]! + 1) {
      throw createError({
        statusCode: 502,
        statusMessage: `Part set ${set.base} has a gap before part ${indexes[i]} (expected ${indexes[i - 1]! + 1})`,
      })
    }
  }
  return set
}

/** Group, order and verify part sets from raw filenames in one call. */
export function resolvePartSets(names: string[]): PartSet[] {
  return groupPartSets(names).map(verifyPartSet)
}