import type { TaskMessage } from "~/server/internal/tasks";
import { WebSocketHandler } from "./ws";
import { logger } from "~/server/internal/logging";

const websocketHandler = new WebSocketHandler("/api/v1/task");
// const taskStates: { [key: string]:  } = {};
const taskStates = new Map<string, Ref<TaskMessage | undefined>>();

function handleUpdateMessage(msg: TaskMessage) {
  const taskStates = useTaskStates();
  const state = taskStates.get(msg.id);
  if (!state) return;
  if (!state.value || msg.reset) {
    state.value = msg;
    return;
  }
  state.value.log.push(...msg.log);

  Object.assign(state.value, { ...msg, log: state.value.log });
}

websocketHandler.listen((message) => {
  try {
    // If it's an object, it's an update message
    const msg = JSON.parse(message) as TaskMessage;
    handleUpdateMessage(msg);
  } catch {
    // Otherwise it's control message
    const taskStates = useTaskStates();

    const [action, ...data] = message.split("/");

    switch (action) {
      case "connect": {
        const taskReady = useTaskReady();
        taskReady.value = true;
        break;
      }
      case "disconnect": {
        const disconnectTaskId = data[0];
        taskStates.delete(disconnectTaskId);
        logger.info(`disconnected from ${disconnectTaskId}`);
        break;
      }
      case "error": {
        const [taskId, title, description] = data;
        const state = taskStates.get(taskId);
        if (!state) break;
        state.value ??= {
          id: taskId,
          name: "Unknown task",
          success: false,
          progress: 0,
          error: undefined,
          log: [],
        };
        state.value.error = { title, description };
        break;
      }
    }
  }
});

const useTaskStates = () => taskStates;

export const useTaskReady = () => useState("taskready", () => false);

export const useTask = (taskId: string): Ref<TaskMessage | undefined> => {
  if (import.meta.server) return ref(undefined);
  const taskStates = useTaskStates();
  const task = taskStates.get(taskId);
  if (task && task.value && !task.value.error) return task;

  taskStates.set(taskId, ref(undefined));
  logger.info("connecting to " + taskId);
  websocketHandler.send(`connect/${taskId}`);
  // TODO: this may have changed behavior
  return taskStates.get(taskId) ?? ref(undefined);
};
