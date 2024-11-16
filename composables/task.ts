import type { TaskMessage } from "~/server/internal/tasks";
import { WebSocketHandler } from "./ws";

const websocketHandler = new WebSocketHandler("/api/v1/task");

websocketHandler.listen((message) => {
  const msg = JSON.parse(message) as TaskMessage;
  const taskStates = useTaskStates();
  const state = taskStates.value[msg.id];
  if (!state) return;
  state.value = msg;
});

const useTaskStates = () =>
  useState<{ [key: string]: Ref<TaskMessage> }>("task-states", () => ({
    connect: useState<TaskMessage>("task-connect", () => ({
      id: "connect",
      name: "Connect",
      success: false,
      progress: 0,
      log: [],
      error: undefined,
    })),
  }));

export const useTaskReady = () => {
  const taskStates = useTaskStates();
  return taskStates.value["connect"];
};

export const useTask = (taskId: string): Ref<TaskMessage> => {
  if (import.meta.server) return {} as unknown as Ref<TaskMessage>;
  const taskStates = useTaskStates();
  if (taskStates.value[taskId]) return taskStates.value[taskId];

  taskStates.value[taskId] = useState(`task-${taskId}`, () => ({
    id: taskId,
    name: "loading...",
    success: false,
    progress: 0,
    error: undefined,
    log: [],
  }));
  websocketHandler.send(`connect/${taskId}`);
  return taskStates.value[taskId];
};
