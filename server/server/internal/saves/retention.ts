export type RetentionCandidate = {
  id: string;
  pinned: boolean;
  objectId: string;
  createdAt: Date;
};

/**
 * Choose versions to prune. Newest first; always keep the head and pinned
 * versions, and keep at least `keep` versions in total. Returns IDs only; the
 * caller deletes rows first and garbage-collects objects after commit.
 */
export function selectVersionsToPrune(
  versions: RetentionCandidate[],
  keep: number,
  headVersionId: string | null,
): string[] {
  const limit = Math.max(1, Math.trunc(keep));
  const ordered = [...versions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const kept = new Set<string>();
  for (const version of ordered.slice(0, limit)) kept.add(version.id);
  if (headVersionId) kept.add(headVersionId);
  for (const version of ordered) {
    if (version.pinned) kept.add(version.id);
  }

  return ordered
    .filter((version) => !kept.has(version.id))
    .map((version) => version.id);
}
