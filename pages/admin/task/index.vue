<template>
  <div>
    <div>
      <h2 class="text-sm font-medium text-zinc-400">
        {{ $t("tasks.admin.runningTasksTitle") }}
      </h2>
      <ul
        role="list"
        class="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-4"
      >
        <li
          v-for="task in liveRunningTasks"
          :key="task.value?.id"
          class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
        >
          <TaskWidget :task="task.value" :active="true" />
        </li>
      </ul>
      <div
        v-if="liveRunningTasks.length == 0"
        class="text-zinc-500 text-sm font-semibold"
      >
        {{ $t("tasks.admin.noTasksRunning") }}
      </div>
    </div>
    <div class="mt-6 w-full grid lg:grid-cols-2 gap-8">
      <div>
        <h2 class="text-sm font-medium text-zinc-400">
          {{ $t("tasks.admin.completedTasksTitle") }}
        </h2>
        <ul role="list" class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <li
            v-for="task in historicalTasks"
            :key="task.id"
            class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
          >
            <TaskWidget :task="task" />
          </li>
        </ul>
      </div>
      <div>
        <h2 class="text-sm font-medium text-zinc-400">
          {{ $t("tasks.admin.dailyScheduledTitle") }}
        </h2>
        <ul role="list" class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <li
            v-for="task in dailyTasks"
            :key="task"
            class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
          >
            <div class="flex w-full items-center justify-between space-x-6 p-6">
              <div class="flex-1">
                <div class="flex items-center space-x-2">
                  <h3 class="text-sm font-medium text-zinc-100">
                    {{ scheduledTasks[task].name }}
                  </h3>
                </div>
                <p class="mt-1 text-sm text-zinc-400">
                  {{ scheduledTasks[task].description }}
                </p>
                <button
                  class="mt-3 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
                  @click="() => startTask(task)"
                >
                  <i18n-t
                    keypath="tasks.admin.execute"
                    tag="span"
                    scope="global"
                    class="inline-flex items-center gap-x-1"
                  >
                    <template #arrow>
                      <PlayIcon class="size-4" aria-hidden="true" />
                    </template>
                  </i18n-t>
                </button>
              </div>
            </div>
          </li>
        </ul>
        <h2 class="text-sm font-medium text-zinc-400 mt-8">
          {{ $t("tasks.admin.weeklyScheduledTitle") }}
        </h2>
        <ul role="list" class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <li
            v-for="task in weeklyTasks"
            :key="task"
            class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
          >
            <div class="flex w-full items-center justify-between space-x-6 p-6">
              <div class="flex-1">
                <div class="flex items-center space-x-2">
                  <h3 class="text-sm font-medium text-zinc-100">
                    {{ scheduledTasks[task].name }}
                  </h3>
                </div>
                <p class="mt-1 text-sm text-zinc-400">
                  {{ scheduledTasks[task].description }}
                </p>
                <button
                  class="mt-3 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
                  @click="() => startTask(task)"
                >
                  <i18n-t
                    keypath="tasks.admin.execute"
                    tag="span"
                    scope="global"
                    class="inline-flex items-center gap-x-1"
                  >
                    <template #arrow>
                      <PlayIcon class="size-4" aria-hidden="true" />
                    </template>
                  </i18n-t>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { PlayIcon } from "@heroicons/vue/24/outline";
import type { TaskGroup } from "~/server/internal/tasks/group";

useHead({
  title: "Tasks",
});

definePageMeta({
  layout: "admin",
});

const { t } = useI18n();

const { runningTasks, historicalTasks, dailyTasks, weeklyTasks } =
  await $dropFetch("/api/v1/admin/task");

const liveRunningTasks = ref(
  await Promise.all(runningTasks.map((e) => useTask(e))),
);

const scheduledTasks: {
  [key in TaskGroup]: { name: string; description: string };
} = {
  "cleanup:invitations": {
    name: t("tasks.admin.scheduled.cleanupInvitationsName"),
    description: t("tasks.admin.scheduled.cleanupInvitationsDescription"),
  },
  "cleanup:objects": {
    name: t("tasks.admin.scheduled.cleanupObjectsName"),
    description: t("tasks.admin.scheduled.cleanupObjectsDescription"),
  },
  "cleanup:sessions": {
    name: t("tasks.admin.scheduled.cleanupSessionsName"),
    description: t("tasks.admin.scheduled.cleanupSessionsDescription"),
  },
  "check:update": {
    name: t("tasks.admin.scheduled.checkUpdateName"),
    description: t("tasks.admin.scheduled.checkUpdateDescription"),
  },
  "import:game": {
    name: "",
    description: "",
  },
  debug: {
    name: "Debug Task",
    description: "Does debugging things.",
  },
};

async function startTask(taskGroup: string) {
  const task = await $dropFetch("/api/v1/admin/task", {
    method: "POST",
    body: { taskGroup },
    failTitle: "Failed to start task",
  });
  const taskRef = await useTask(task.id);
  liveRunningTasks.value.push(taskRef);
}
</script>
