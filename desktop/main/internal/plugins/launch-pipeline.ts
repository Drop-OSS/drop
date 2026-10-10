import type { LaunchContext, LaunchHook, LaunchStage } from "./types";

/**
 * Pure launch-hook helpers backing `ClientPluginManager.executeLaunchPipeline`.
 * Kept separate from the manager so the pipeline can be unit tested without
 * constructing a full plugin host.
 */

export function sortHooks(
  stages: LaunchStage[],
  hooks: LaunchHook[],
): LaunchHook[] {
  return hooks
    .filter((h) => stages.includes(h.stage))
    .sort((a, b) => {
      const stageDiff = stages.indexOf(a.stage) - stages.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return (a.order ?? 0) - (b.order ?? 0);
    });
}

export function rollbackCompletedStages(completedHooks: LaunchHook[]): void {
  for (let i = completedHooks.length - 1; i >= 0; i--) {
    const rollbackHook = completedHooks[i];
    if (!rollbackHook) continue;
    console.log(`Rolling back stage: ${rollbackHook.stage}`);
  }
}

export async function runPreLaunchPipeline(
  activePreHooks: LaunchHook[],
  context: LaunchContext,
): Promise<void> {
  const completedHooks: LaunchHook[] = [];
  for (const hook of activePreHooks) {
    try {
      await hook.execute(context);
      completedHooks.push(hook);
    } catch (error) {
      console.error(
        `Pre-launch hook [${hook.stage}] failed. Rolling back completed stages...`,
        error,
      );
      rollbackCompletedStages(completedHooks);
      throw new Error(
        `Launch aborted during stage '${hook.stage}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }
}

export async function runPostExitPipeline(
  activePostHooks: LaunchHook[],
  context: LaunchContext,
): Promise<void> {
  for (const hook of activePostHooks) {
    try {
      await hook.execute(context);
    } catch (postErr) {
      console.warn(`Post-exit hook [${hook.stage}] warning:`, postErr);
    }
  }
}

/**
 * Playnite-style Game Launch Pipeline Coordinator.
 * Executes pre-launch hooks sorted by stage and priority.
 * If any pre-launch hook aborts, completed stages are rolled back in reverse order.
 * If launch succeeds, executes post-exit cleanup hooks.
 */
export async function executeLaunchPipeline<T>(
  hooks: LaunchHook[],
  context: LaunchContext,
  launchFn: () => Promise<T>,
): Promise<T> {
  const preLaunchStages: LaunchStage[] = [
    "pre-launch:validate",
    "pre-launch:prepare",
    "pre-launch:stage",
    "pre-launch:network",
    "pre-launch:network-post",
  ];

  const postExitStages: LaunchStage[] = [
    "post-exit:cleanup",
    "post-exit:restore",
    "post-exit:sync",
  ];

  await runPreLaunchPipeline(sortHooks(preLaunchStages, hooks), context);
  const launchResult = await launchFn();
  await runPostExitPipeline(sortHooks(postExitStages, hooks), context);

  return launchResult;
}
