import droplet from "@drop-oss/droplet";
import type { MinimumRequestObject } from "~/server/h3";
import type { GlobalACL } from "../acls";
import aclManager from "../acls";

import cleanupInvites from "./registry/invitations";
import cleanupSessions from "./registry/sessions";
import checkUpdate from "./registry/update";
import cleanupObjects from "./registry/objects";
import { taskGroups, type TaskGroup } from "./group";
import prisma from "../db/database";
import { type } from "arktype";
import ludusavi from "./registry/ludusavi";

// a task that has been run
type FinishedTask = {
  success: boolean;
  progress: number;
  log: string[];
  error: { title: string; description: string } | undefined;
  name: string;
  taskGroup: TaskGroup;
  acls: string[];

  // ISO timestamp of when the task started
  startTime: string;
  // ISO timestamp of when the task ended
  endTime: string | undefined;
};

// a currently running task in the pool
type TaskPoolEntry = FinishedTask & {
  clients: Map<string, boolean>;
};

/**
 * The TaskHandler setups up two-way connections to web clients and manages the state for them
 * This allows long-running tasks (like game imports and such) to report progress, success and error states
 * easily without re-inventing the wheel every time.
 */
class TaskHandler {
  // registry of schedualed tasks to be created
  private taskCreators: Map<TaskGroup, () => Task> = new Map();

  // list of all currently running tasks
  private taskPool = new Map<string, TaskPoolEntry>();
  // list of all clients currently connected to tasks
  private clientRegistry = new Map<string, PeerImpl>();

  private dailyScheduledTasks: TaskGroup[] = [
    "cleanup:invitations",
    "cleanup:sessions",
    "check:update",
  ];
  private weeklyScheduledTasks: TaskGroup[] = ["cleanup:objects"];

  constructor() {
    // register the cleanup invitations task
    this.saveScheduledTask(cleanupInvites);
    this.saveScheduledTask(cleanupSessions);
    this.saveScheduledTask(checkUpdate);
    this.saveScheduledTask(cleanupObjects);
    this.saveScheduledTask(ludusavi)
  }

  /**
   * Saves scheduled task to the registry
   * @param createTask
   */
  private saveScheduledTask(task: DropTask) {
    this.taskCreators.set(task.taskGroup, task.build);
  }

  create(task: Task) {
    let updateCollectTimeout: NodeJS.Timeout | undefined;
    let updateCollectResolves: Array<(value: unknown) => void> = [];
    let logOffset: number = 0;

    // if taskgroup disallows concurrency
    if (!taskGroups[task.taskGroup].concurrency) {
      for (const existingTask of this.taskPool.values()) {
        // if a task is already running, we don't want to start another
        if (existingTask.taskGroup === task.taskGroup) {
          // TODO: handle this more gracefully, maybe with a queue? should be configurable
          console.warn(
            `Task group ${task.taskGroup} does not allow concurrent tasks. Task ${task.id} will not be started.`,
          );
          throw new Error(
            `Task group ${task.taskGroup} does not allow concurrent tasks.`,
          );
        }
      }
    }

    const updateAllClients = (reset = false) =>
      new Promise((r) => {
        if (updateCollectTimeout) {
          updateCollectResolves.push(r);
          return;
        }
        updateCollectTimeout = setTimeout(() => {
          const taskEntry = this.taskPool.get(task.id);
          if (!taskEntry) return;

          const taskMessage: TaskMessage = {
            id: task.id,
            name: task.name,
            success: taskEntry.success,
            progress: taskEntry.progress,
            error: taskEntry.error,
            log: taskEntry.log.slice(logOffset),
            reset,
          };
          logOffset = taskEntry.log.length;

          for (const clientId of taskEntry.clients.keys()) {
            const client = this.clientRegistry.get(clientId);
            if (!client) continue;
            client.send(JSON.stringify(taskMessage));
          }
          updateCollectTimeout = undefined;

          for (const resolve of updateCollectResolves) {
            resolve(undefined);
          }
          r(undefined);
          updateCollectResolves = [];
        }, 100);
      });

    const log = (entry: string) => {
      const taskEntry = this.taskPool.get(task.id);
      if (!taskEntry) return;
      taskEntry.log.push(msgWithTimestamp(entry));
      updateAllClients();
    };

    const progress = (progress: number) => {
      if (progress < 0 || progress > 100) {
        console.error("Progress must be between 0 and 100", { progress });
        return;
      }
      const taskEntry = this.taskPool.get(task.id);
      if (!taskEntry) return;
      taskEntry.progress = progress;
      // log(`Progress: ${progress}%`);
      updateAllClients();
    };

    this.taskPool.set(task.id, {
      name: task.name,
      taskGroup: task.taskGroup,
      success: false,
      progress: 0,
      error: undefined,
      log: [],
      clients: new Map(),
      acls: task.acls,
      startTime: new Date().toISOString(),
      endTime: undefined,
    });

    updateAllClients(true);

    droplet.callAltThreadFunc(async () => {
      const taskEntry = this.taskPool.get(task.id);
      if (!taskEntry) throw new Error("No task entry");

      try {
        await task.run({ progress, log });
        taskEntry.success = true;
      } catch (error: unknown) {
        taskEntry.success = false;
        taskEntry.error = {
          title: "An error occurred",
          description: (error as string).toString(),
        };
      }

      taskEntry.endTime = new Date().toISOString();
      await updateAllClients();

      for (const clientId of taskEntry.clients.keys()) {
        if (!this.clientRegistry.get(clientId)) continue;
        this.disconnect(clientId, task.id);
      }

      await prisma.task.create({
        data: {
          id: task.id,
          taskGroup: taskEntry.taskGroup,
          name: taskEntry.name,

          started: taskEntry.startTime,
          ended: taskEntry.endTime,

          success: taskEntry.success,
          progress: taskEntry.progress,
          log: taskEntry.log,

          acls: taskEntry.acls,

          ...(taskEntry.error
            ? { error: JSON.stringify(taskEntry.error) }
            : undefined),
        },
      });

      this.taskPool.delete(task.id);
    });
  }

  async connect(
    clientId: string,
    taskId: string,
    peer: PeerImpl,
    request: MinimumRequestObject,
  ) {
    const task =
      this.taskPool.get(taskId) ??
      (await prisma.task.findUnique({ where: { id: taskId } }));
    if (!task) {
      peer.send(
        `error/${taskId}/Unknown task/Drop couldn't find the task you're looking for.`,
      );
      return;
    }

    const allowed = await aclManager.hasACL(request, task.acls);
    if (!allowed) {
      console.warn("user does not have necessary ACLs");
      peer.send(
        `error/${taskId}/Unknown task/Drop couldn't find the task you're looking for.`,
      );
      return;
    }

    this.clientRegistry.set(clientId, peer);
    if ("clients" in task) {
      task.clients.set(clientId, true); // Uniquely insert client to avoid sending duplicate traffic
    }

    const catchupMessage: TaskMessage = {
      id: taskId,
      name: task.name,
      success: task.success,
      error: task.error as unknown as
        | { title: string; description: string }
        | undefined,
      log: task.log,
      progress: task.progress,
    };
    peer.send(JSON.stringify(catchupMessage));
  }

  sendDisconnectEvent(id: string, taskId: string) {
    const client = this.clientRegistry.get(id);
    if (!client) return;
    client.send(`disconnect/${taskId}`);
  }

  disconnectAll(id: string) {
    for (const taskId of this.taskPool.keys()) {
      this.taskPool.get(taskId)?.clients.delete(id);
      this.sendDisconnectEvent(id, taskId);
    }

    this.clientRegistry.delete(id);
  }

  disconnect(id: string, taskId: string) {
    const task = this.taskPool.get(taskId);
    if (!task) return false;

    task.clients.delete(id);
    this.sendDisconnectEvent(id, taskId);

    const allClientIds = this.taskPool
      .values()
      .toArray()
      .map((e) => e.clients.keys().toArray())
      .flat();

    if (!allClientIds.includes(id)) {
      this.clientRegistry.delete(id);
    }

    return true;
  }

  runningTasks() {
    return this.taskPool
      .entries()
      .map(([id, value]) => ({ ...value, id, log: undefined }))
      .toArray();
  }

  dailyTasks() {
    return this.dailyScheduledTasks;
  }

  weeklyTasks() {
    return this.weeklyScheduledTasks;
  }

  runTaskGroupByName(name: TaskGroup) {
    const task = this.taskCreators.get(name);
    if (!task) {
      console.warn(`No task found for group ${name}`);
      return;
    }
    this.create(task());
  }

  /**
   * Runs all daily tasks that are scheduled to run once a day.
   */
  async triggerDailyTasks() {
    for (const taskGroup of this.dailyScheduledTasks) {
      const mostRecent = await prisma.task.findFirst({
        where: {
          taskGroup,
        },
        orderBy: {
          ended: "desc",
        },
      });
      if (mostRecent) {
        const currentTime = Date.now();
        const lastRun = mostRecent.ended.getTime();
        const difference = currentTime - lastRun;
        if (difference < 1000 * 60 * 60 * 24) {
          // If it's been less than one day
          continue; // skip
        }
      }
      await this.runTaskGroupByName(taskGroup);
    }

    // After running daily tasks, trigger weekly tasks as well
    await this.triggerWeeklyTasks();
  }

  private async triggerWeeklyTasks() {
    for (const taskGroup of this.weeklyScheduledTasks) {
      const mostRecent = await prisma.task.findFirst({
        where: {
          taskGroup,
        },
        orderBy: {
          ended: "desc",
        },
      });
      if (mostRecent) {
        const currentTime = Date.now();
        const lastRun = mostRecent.ended.getTime();
        const difference = currentTime - lastRun;
        if (difference < 1000 * 60 * 60 * 24 * 7) {
          // If it's been less than one week
          continue; // skip
        }
      }
      await this.runTaskGroupByName(taskGroup);
    }
  }
}

export type TaskRunContext = {
  progress: (progress: number) => void;
  log: (message: string) => void;
};

export function wrapTaskContext(
  context: TaskRunContext,
  options: { min: number; max: number; prefix: string },
): TaskRunContext {
  return {
    progress(progress) {
      if (progress > 100 || progress < 0) {
        console.warn("[wrapTaskContext] progress must be between 0 and 100");
      }

      // I was too tired to figure this out
      // https://stackoverflow.com/a/929107
      const oldRange = 100;
      const newRange = options.max - options.min;
      const adjustedProgress = (progress * newRange) / oldRange + options.min;
      return context.progress(adjustedProgress);
    },
    log(message) {
      return context.log(options.prefix + message);
    },
  };
}

export interface Task {
  id: string;
  taskGroup: TaskGroup;
  name: string;
  run: (context: TaskRunContext) => Promise<void>;
  acls: GlobalACL[];
}

export type TaskMessage = {
  id: string;
  name: string;
  success: boolean;
  progress: number;
  error: undefined | { title: string; description: string };
  log: string[];
  reset?: boolean;
};

export type PeerImpl = {
  send: (message: string) => void;
};

export interface BuildTask {
  buildId: () => string;
  taskGroup: TaskGroup;
  name: string;
  run: (context: TaskRunContext) => Promise<void>;
  acls: GlobalACL[];
}

interface DropTask {
  taskGroup: TaskGroup;
  build: () => Task;
}

export const TaskLog = type({
  timestamp: "string",
  message: "string",
});

/**
 * Create a log message with a timestamp in the format YYYY-MM-DD HH:mm:ss.SSS UTC
 * @param message
 * @returns
 */
function msgWithTimestamp(message: string): string {
  const now = new Date();

  const pad = (n: number, width = 2) => n.toString().padStart(width, "0");

  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());

  const hours = pad(now.getUTCHours());
  const minutes = pad(now.getUTCMinutes());
  const seconds = pad(now.getUTCSeconds());
  const milliseconds = pad(now.getUTCMilliseconds(), 3);

  const log: typeof TaskLog.infer = {
    timestamp: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} UTC`,
    message,
  };
  return JSON.stringify(log);
}

export function defineDropTask(buildTask: BuildTask): DropTask {
  // TODO: only let one task with the same taskGroup run at the same time if specified

  return {
    taskGroup: buildTask.taskGroup,
    build: () => ({
      id: buildTask.buildId(),
      taskGroup: buildTask.taskGroup,
      name: buildTask.name,
      run: buildTask.run,
      acls: buildTask.acls,
    }),
  };
}

export const taskHandler = new TaskHandler();
export default taskHandler;
