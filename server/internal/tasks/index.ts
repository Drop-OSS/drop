import droplet from "@drop-oss/droplet";
import type { MinimumRequestObject } from "~/server/h3";
import aclManager from "../acls";

/**
 * The TaskHandler setups up two-way connections to web clients and manages the state for them
 * This allows long-running tasks (like game imports and such) to report progress, success and error states
 * easily without re-inventing the wheel every time.
 */

type TaskRegistryEntry = {
  success: boolean;
  progress: number;
  log: string[];
  error: { title: string; description: string } | undefined;
  clients: Map<string, boolean>;
  name: string;
  acls: string[];
};

class TaskHandler {
  // TODO: make these maps, using objects like this has performance impacts
  // https://typescript-eslint.io/rules/no-dynamic-delete/
  private taskRegistry = new Map<string, TaskRegistryEntry>();
  private clientRegistry = new Map<string, PeerImpl>();
  startTasks: (() => void)[] = [];

  create(task: Task) {
    let updateCollectTimeout: NodeJS.Timeout | undefined;
    let updateCollectResolves: Array<(value: unknown) => void> = [];
    let logOffset: number = 0;

    const updateAllClients = (reset = false) =>
      new Promise((r) => {
        if (updateCollectTimeout) {
          updateCollectResolves.push(r);
          return;
        }
        updateCollectTimeout = setTimeout(() => {
          const taskEntry = this.taskRegistry.get(task.id);
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

          for (const clientId of Object.keys(taskEntry.clients)) {
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
      const taskEntry = this.taskRegistry.get(task.id);
      if (!taskEntry) return;
      taskEntry.progress = progress;
      updateAllClients();
    };

    const log = (entry: string) => {
      const taskEntry = this.taskRegistry.get(task.id);
      if (!taskEntry) return;
      taskEntry.log.push(entry);
      updateAllClients();
    };

    this.taskRegistry.set(task.id, {
      name: task.name,
      success: false,
      progress: 0,
      error: undefined,
      log: [],
      clients: new Map(),
      acls: task.acls,
    });

    updateAllClients(true);

    droplet.callAltThreadFunc(async () => {
      const taskEntry = this.taskRegistry.get(task.id);
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
      await updateAllClients();

      for (const clientId of Object.keys(taskEntry.clients)) {
        if (!this.clientRegistry.get(clientId)) continue;
        this.disconnect(clientId, task.id);
      }
      this.taskRegistry.delete(task.id);
    });
  }

  async connect(
    clientId: string,
    taskId: string,
    peer: PeerImpl,
    request: MinimumRequestObject,
  ) {
    const task = this.taskRegistry.get(taskId);
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
    for (const taskId of Object.keys(this.taskRegistry)) {
      this.taskRegistry.get(taskId)?.clients.delete(id);
      this.sendDisconnectEvent(id, taskId);
    }

    this.clientRegistry.delete(id);
  }

  disconnect(id: string, taskId: string) {
    const task = this.taskRegistry.get(taskId);
    if (!task) return false;

    task.clients.delete(id);
    this.sendDisconnectEvent(id, taskId);

    const allClientIds = Object.values(this.taskRegistry)
      .map((_) => Object.keys(_.clients))
      .flat();

    if (!allClientIds.includes(id)) {
      this.clientRegistry.delete(id);
    }

    return true;
  }
}

export type TaskRunContext = {
  progress: (progress: number) => void;
  log: (message: string) => void;
};

export interface Task {
  id: string;
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

export const taskHandler = new TaskHandler();
export default taskHandler;
