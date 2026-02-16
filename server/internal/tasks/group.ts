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
  debug: {
    concurrency: true,
  },
} as const;

export type TaskGroup = keyof typeof taskGroups;
