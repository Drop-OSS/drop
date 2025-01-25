import droplet from "@drop/droplet";

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
  clients: { [key: string]: boolean };
  name: string;
  requireAdmin: boolean;
};

class TaskHandler {
  private taskRegistry: { [key: string]: TaskRegistryEntry } = {};
  private clientRegistry: { [key: string]: PeerImpl } = {};
  startTasks: (() => void)[] = [];

  constructor() {}

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
          const taskEntry = this.taskRegistry[task.id];
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

          for (const client of Object.keys(taskEntry.clients)) {
            if (!this.clientRegistry[client]) continue;
            this.clientRegistry[client].send(JSON.stringify(taskMessage));
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
      const taskEntry = this.taskRegistry[task.id];
      if (!taskEntry) return;
      this.taskRegistry[task.id].progress = progress;
      updateAllClients();
    };

    const log = (entry: string) => {
      const taskEntry = this.taskRegistry[task.id];
      if (!taskEntry) return;
      this.taskRegistry[task.id].log.push(entry);
      updateAllClients();
    };

    this.taskRegistry[task.id] = {
      name: task.name,
      success: false,
      progress: 0,
      error: undefined,
      log: [],
      clients: {},
      requireAdmin: task.requireAdmin ?? false,
    };

    updateAllClients(true);

    droplet.callAltThreadFunc(async () => {
      const taskEntry = this.taskRegistry[task.id];
      if (!taskEntry) throw new Error("No task entry");

      try {
        await task.run({ progress, log });
        this.taskRegistry[task.id].success = true;
      } catch (error: unknown) {
        this.taskRegistry[task.id].success = false;
        this.taskRegistry[task.id].error = {
          title: "An error occurred",
          description: (error as string).toString(),
        };
      }
      await updateAllClients();

      for (const client of Object.keys(taskEntry.clients)) {
        if (!this.clientRegistry[client]) continue;
        this.disconnect(client, task.id);
      }
      delete this.taskRegistry[task.id];
    });
  }

  connect(id: string, taskId: string, peer: PeerImpl, isAdmin = false) {
    const task = this.taskRegistry[taskId];
    if (!task) {
      peer.send(
        `error/${taskId}/Unknown task/Drop couldn't find the task you're looking for.`
      );
      return;
    }

    if (task.requireAdmin && !isAdmin) {
      console.warn("user is not an admin, so cannot view this task");
      peer.send(
        `error/${taskId}/Unknown task/Drop couldn't find the task you're looking for.`
      );
      return;
    }

    this.clientRegistry[id] = peer;
    this.taskRegistry[taskId].clients[id] = true; // Uniquely insert client to avoid sending duplicate traffic

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
    const client = this.clientRegistry[id];
    if (!client) return;
    client.send(`disconnect/${taskId}`);
  }

  disconnectAll(id: string) {
    for (const taskId of Object.keys(this.taskRegistry)) {
      delete this.taskRegistry[taskId].clients[id];
      this.sendDisconnectEvent(id, taskId);
    }

    delete this.clientRegistry[id];
  }

  disconnect(id: string, taskId: string) {
    if (!this.taskRegistry[taskId]) return false;

    delete this.taskRegistry[taskId].clients[id];
    this.sendDisconnectEvent(id, taskId);

    const allClientIds = Object.values(this.taskRegistry)
      .map((_) => Object.keys(_.clients))
      .flat();

    if (!allClientIds.includes(id)) {
      delete this.clientRegistry[id];
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
  requireAdmin?: boolean;
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
