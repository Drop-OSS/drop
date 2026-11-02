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
} as const;

export type TaskGroup = keyof typeof taskGroups;
