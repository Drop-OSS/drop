export type SyncDecision = "noop" | "push" | "pull" | "converged" | "conflict";

export type SyncState = {
  /** Version the client last synced from. `null` means no baseline. */
  baseVersionId: string | null;
  /** Current server head. `null` means the slot has no versions. */
  headVersionId: string | null;
  /** Content hash the client has locally, if known. */
  localContentHash: string | null;
  /** Content hash of the baseline version, if known. */
  baseContentHash: string | null;
  /** Content hash of the current server head, if known. */
  headContentHash: string | null;
};

/**
 * Decide what a client should do. Timestamps never participate: version
 * identity and content hashes are authoritative, so clock skew cannot cause a
 * silent overwrite.
 */
export function decideSync(state: SyncState): SyncDecision {
  const {
    baseVersionId,
    headVersionId,
    localContentHash,
    baseContentHash,
    headContentHash,
  } = state;

  // Nothing stored yet: whatever this device has becomes the first version.
  if (headVersionId === null)
    return localContentHash === null ? "noop" : "push";

  // A device that never synced and has nothing local just takes the head.
  if (localContentHash === null && baseVersionId === null) return "pull";

  if (headContentHash !== null && localContentHash === headContentHash)
    return "converged";

  // The server has not moved, so only this device can have changes.
  if (baseVersionId === headVersionId) {
    if (localContentHash === null || localContentHash === baseContentHash)
      return "noop";
    return "push";
  }

  // The server has moved. Pull only when local content still matches the
  // baseline the client synced from; an unknown local hash means the client
  // must go measure its saves before anything may be overwritten.
  if (
    localContentHash !== null &&
    baseContentHash !== null &&
    localContentHash === baseContentHash
  )
    return "pull";

  return "conflict";
}
