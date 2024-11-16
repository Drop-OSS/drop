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
  error: string | undefined;
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

    const updateAllClients = () => {
      if (updateCollectTimeout) return;
      updateCollectTimeout = setTimeout(() => {
        const taskEntry = this.taskRegistry[task.id];
        if (!taskEntry) return;
        const taskMessage: TaskMessage = {
          id: task.id,
          name: task.name,
          success: taskEntry.success,
          progress: taskEntry.progress,
          error: taskEntry.error,
          log: taskEntry.log.reverse().slice(0, 50),
        };
        for (const client of Object.keys(taskEntry.clients)) {
          if (!this.clientRegistry[client]) continue;
          this.clientRegistry[client].send(JSON.stringify(taskMessage));
        }
        updateCollectTimeout = undefined;
      }, 100);
    };

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

    droplet.callAltThreadFunc(async () => {
      const promiseRun = task.run({ progress, log });
      promiseRun.then(() => {
        const taskEntry = this.taskRegistry[task.id];
        if (!taskEntry) return;
        this.taskRegistry[task.id].success = true;
        updateAllClients();
      });
      promiseRun.catch((error) => {
        const taskEntry = this.taskRegistry[task.id];
        if (!taskEntry) return;
        this.taskRegistry[task.id].success = false;
        this.taskRegistry[task.id].error = error;
        updateAllClients();
      });
    });
  }

  connect(id: string, taskId: string, peer: PeerImpl, isAdmin = false) {
    const task = this.taskRegistry[taskId];
    if (!task) return "Invalid task";

    if (task.requireAdmin && !isAdmin) return "Requires admin";

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

    return true;
  }

  disconnectAll(id: string) {
    for (const [taskId] of Object.keys(this.taskRegistry)) {
      delete this.taskRegistry[taskId].clients[id];
    }
    
    delete this.clientRegistry[id];
  }

  disconnect(id: string, taskId: string) {
    if (!this.taskRegistry[taskId]) return false;

    delete this.taskRegistry[taskId].clients[id];

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
  error: undefined | string;
  log: string[];
};

export type PeerImpl = {
  send: (message: string) => void;
};

export const taskHandler = new TaskHandler();
export default taskHandler;
