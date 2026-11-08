import { defineDropTask } from "..";

/**
 * The daily keep-current pass over the node-owned providers.
 *
 * The admin button answers "check me now"; this task is the answer to
 * "the node notices by itself": GOG and Ubisoft connections are scanned
 * with the shared provider scan, newer builds of already-acquired games
 * are queued through the ingest pipeline, and the task log says what it
 * found. A provider with no stored connection is simply not a provider
 * this node owns - that round is a skip, not a failure.
 */
export default defineDropTask({
  buildId: () => `depot:check-updates:${new Date().toISOString()}`,
  name: "Check depot providers for updates",
  acls: ["system:maintenance:read"],
  taskGroup: "depot:check-updates",
  async run({ progress, logger }) {
    const { scanGogUpdates, scanUbisoftUpdates } =
      await import("~/server/utils/depot/update-scan");

    let done = 0;
    for (const [name, scan] of [
      ["GOG", scanGogUpdates],
      ["Ubisoft", scanUbisoftUpdates],
    ] as const) {
      try {
        const result = await scan();
        const queued = result.updates.filter((u) => u.queued).length;
        logger.info(
          `${name}: ${result.checked} games checked, ` +
            `${result.updates.length} newer build(s) (${queued} queued), ` +
            `${result.unimported.length} owned but never acquired`,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 400) {
          // No stored connection: this node does not own that provider.
          logger.info(`${name}: no connection to check, skipping`);
        } else {
          logger.warn(
            `${name}: check failed - ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      done += 1;
      progress(done * 50);
    }
  },
});
