import taskHandler from "~/server/internal/tasks";

export default defineTask({
  meta: {
    name: "dailyTasks",
  },
  async run() {
    taskHandler.triggerDailyTasks();

    return {};
  },
});
