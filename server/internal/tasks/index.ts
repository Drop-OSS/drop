import droplet from "@drop-oss/droplet";
import type { MinimumRequestObject } from "~/server/h3";
import aclManager from "../acls";

import cleanupInvites from "./registry/invitations";
import cleanupSessions from "./registry/sessions";
import checkUpdate from "./registry/update";
import cleanupObjects from "./registry/objects";
import { taskGroups, type TaskGroup } from "./group";

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
  private scheduledTasks: Map<TaskGroup, () => Task> = new Map();
  // list of all finished tasks
  private finishedTasks: Map<string, FinishedTask> = new Map();

  // list of all currently running tasks
  private taskPool = new Map<string, TaskPoolEntry>();
  // list of all clients currently connected to tasks
  private clientRegistry = new Map<string, PeerImpl>();

  constructor() {
    // register the cleanup invitations task
    this.saveScheduledTask(cleanupInvites);
    this.saveScheduledTask(cleanupSessions);
    this.saveScheduledTask(checkUpdate);
    this.saveScheduledTask(cleanupObjects);
  }

  /**
   * Saves scheduled task to the registry
   * @param createTask
   */
  private saveScheduledTask(task: DropTask) {
    this.scheduledTasks.set(task.taskGroup, task.build);
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

    const progress = (progress: number) => {
      const taskEntry = this.taskPool.get(task.id);
      if (!taskEntry) return;
      taskEntry.progress = progress;
      updateAllClients();
    };

    const log = (entry: string) => {
      const taskEntry = this.taskPool.get(task.id);
      if (!taskEntry) return;
      taskEntry.log.push(entry);
      console.log(`[Task ${task.taskGroup}]: ${entry}`);
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

      // so we can drop the clients from the task entry
      const { clients, ...copied } = taskEntry;
      this.finishedTasks.set(task.id, {
        ...copied,
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
    const task = this.taskPool.get(taskId);
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
    task.clients.set(clientId, true); // Uniquely insert client to avoid sending duplicate traffic

    const catchupMessage: TaskMessage = {
      id: taskId,
      name: task.name,
      success: task.success,
      error: task.error,
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

  /**]
   * Runs all daily tasks that are scheduled to run once a day.
   */
  triggerDailyTasks() {
    const invites = this.scheduledTasks.get("cleanup:invitations");
    if (invites) {
      this.create(invites());
    }
    const sessions = this.scheduledTasks.get("cleanup:sessions");
    if (sessions) {
      this.create(sessions());
    }
    const update = this.scheduledTasks.get("check:update");
    if (update) {
      this.create(update());
    }
  }
}

export type TaskRunContext = {
  progress: (progress: number) => void;
  log: (message: string) => void;
};

export interface Task {
  id: string;
  taskGroup: TaskGroup;
  name: string;
  run: (context: TaskRunContext) => Promise<void>;
  acls: string[];
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
  acls: string[];
}

interface DropTask {
  taskGroup: TaskGroup;
  build: () => Task;
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
