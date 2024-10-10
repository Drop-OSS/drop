import type { TaskMessage } from "~/server/internal/tasks";

let ws: WebSocket | undefined;
const msgQueue: Array<string> = [];

const useTaskStates = () =>
  useState<{ [key: string]: Ref<TaskMessage> }>("task-states", () => ({
    connect: useState<TaskMessage>("task-connect", () => ({
      id: "connect",
      success: false,
      progress: 0,
      log: [],
      error: undefined,
    })),
  }));

function initWs() {
  const isSecure = location.protocol === "https:";
  const url = (isSecure ? "wss://" : "ws://") + location.host + "/api/v1/task";
  ws = new WebSocket(url);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data) as TaskMessage;
    const taskStates = useTaskStates();
    const state = taskStates.value[msg.id];
    if (!state) return;
    state.value = msg;
  };
  ws.onopen = () => {
    for (const message of msgQueue) {
      ws?.send(message);
    }
  };

  return ws;
}

function sendMessage(msg: string) {
  if (!ws) return msgQueue.push(msg);
  if (ws.readyState == 0) return msgQueue.push(msg);
  return ws.send(msg);
}

export const useTaskReady = () => {
  const taskStates = useTaskStates();
  return taskStates.value["connect"];
};

export const useTask = (taskId: string): Ref<TaskMessage> => {
  if (import.meta.server) return {} as unknown as Ref<TaskMessage>;
  const taskStates = useTaskStates();
  if (taskStates.value[taskId]) return taskStates.value[taskId];

  if (!ws) initWs();
  taskStates.value[taskId] = useState(`task-${taskId}`, () => ({
    id: taskId,
    success: false,
    progress: 0,
    error: undefined,
    log: [],
  }));
  sendMessage(`connect/${taskId}`);
  return taskStates.value[taskId];
};
