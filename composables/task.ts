import type { TaskMessage } from "~/server/internal/tasks";
import { WebSocketHandler } from "./ws";

const websocketHandler = new WebSocketHandler("/api/v1/task");
const taskStates: { [key: string]: Ref<TaskMessage | undefined> } = {};

function handleUpdateMessage(msg: TaskMessage) {
  const taskStates = useTaskStates();
  const state = taskStates[msg.id];
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
      case "connect":
        const taskReady = useTaskReady();
        taskReady.value = true;
        break;
      case "disconnect":
        const disconnectTaskId = data[0];
        delete taskStates[disconnectTaskId];
        console.log(`disconnected from ${disconnectTaskId}`);
        break;
      case "error":
        const [taskId, title, description] = data;
        taskStates[taskId].value ??= {
          id: taskId,
          name: "Unknown task",
          success: false,
          progress: 0,
          error: undefined,
          log: [],
        };
        taskStates[taskId].value.error = { title, description };
        break;
    }
  }
});

const useTaskStates = () => taskStates;

export const useTaskReady = () => useState("taskready", () => false);

export const useTask = (taskId: string): Ref<TaskMessage | undefined> => {
  if (import.meta.server) return ref(undefined);
  const taskStates = useTaskStates();
  if (
    taskStates[taskId] &&
    taskStates[taskId].value &&
    !taskStates[taskId].value.error
  )
    return taskStates[taskId];

  taskStates[taskId] = ref(undefined);
  console.log("connecting to " + taskId);
  websocketHandler.send(`connect/${taskId}`);
  return taskStates[taskId];
};
