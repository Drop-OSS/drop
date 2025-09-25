export const TASK_GROUPS = [
  "cleanup:invitations",
  "cleanup:objects",
  "cleanup:sessions",
  "check:update",
  "import:game",
  "import:version",
] as const;

export type TaskGroup = (typeof TASK_GROUPS)[number];

export const TASK_GROUP_CONFIG: { [key in TaskGroup]: { concurrency: boolean } } =
  {
    "cleanup:invitations": {
      concurrency: false
    },
    "cleanup:objects": {
      concurrency: false
    },
    "cleanup:sessions": {
      concurrency: false
    },
    "check:update": {
      concurrency: false
    },
    "import:game": {
      concurrency: true
    },
    "import:version": {
      concurrency: true
    }
  };
