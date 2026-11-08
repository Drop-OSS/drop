export const taskGroups = {
  "cleanup:invitations": {
    concurrency: false,
  },
  "cleanup:objects": {
    concurrency: false,
  },
  "cleanup:sessions": {
    concurrency: false,
  },
  "check:update": {
    concurrency: false,
  },
  "import:game": {
    concurrency: true,
  },
  "import:version": {
    concurrency: true,
  },
  "import:check-integrity": {
    concurrency: false,
  },
  // Depot acquisitions (store CDN -> CAS). Serialised: two games streaming
  // at once would fight over disk and trip store CDN politeness limits.
  "depot:ingest": {
    concurrency: false,
  },
  // The daily scan of the node's store connections for newer builds. One
  // at a time, and never beside itself: it queues depot ingests, and two
  // overlapping scans would ask the same accounts the same questions.
  "depot:check-updates": {
    concurrency: false,
  },
} as const;

export type TaskGroup = keyof typeof taskGroups;
