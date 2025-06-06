<template>
  <div>
    <div>
      <h2 class="text-sm font-medium text-zinc-400">Running tasks</h2>
      <ul
        role="list"
        class="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <li
          v-for="task in liveRunningTasks"
          :key="task.value?.id"
          class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
        >
          <div
            v-if="task.value"
            class="flex w-full items-center justify-between space-x-6 p-6"
          >
            <div class="flex-1 truncate">
              <div class="flex items-center space-x-2">
                <div>
                  <CheckIcon
                    v-if="task.value.success"
                    class="size-4 text-green-600"
                  />
                  <XMarkIcon
                    v-else-if="task.value.error"
                    class="size-4 text-red-600"
                  />
                  <div
                    v-else
                    class="size-2 bg-blue-600 rounded-full animate-pulse"
                  />
                </div>
                <h3 class="truncate text-sm font-medium text-zinc-100">
                  {{ task.value.name }}
                </h3>
              </div>
              <div class="mt-1 w-full rounded-full overflow-hidden bg-zinc-900">
                <div
                  :style="{ width: `${task.value.progress}%` }"
                  class="bg-blue-600 h-1.5 transition-all"
                />
              </div>
              <p class="mt-1 truncate text-sm text-zinc-400">
                {{ task.value.log.at(-1) }}
              </p>
              <NuxtLink
                type="button"
                :href="`/admin/task/${task.value.id}`"
                class="mt-3 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
              >
                View &rarr;
              </NuxtLink>
            </div>
          </div>
          <div v-else>
            <!-- renders server side when we don't want to access the current tasks -->
          </div>
        </li>
      </ul>
      <div
        v-if="liveRunningTasks.length == 0"
        class="text-zinc-500 text-sm font-semibold"
      >
        No tasks currently running
      </div>
    </div>
    <div class="mt-6 w-full grid lg:grid-cols-2 gap-8">
      <div>
        <h2 class="text-sm font-medium text-zinc-400">Completed tasks</h2>
        <ul role="list" class="mt-4 grid grid-cols-1 gap-6">
          <li
            v-for="task in historicalTasks"
            :key="task.id"
            class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
          >
            <div class="flex w-full items-center justify-between space-x-6 p-6">
              <div class="flex-1 truncate">
                <div class="flex items-center space-x-2">
                  <div>
                    <CheckIcon
                      v-if="task.success"
                      class="size-4 text-green-600"
                    />
                    <XMarkIcon
                      v-else-if="task.error"
                      class="size-4 text-red-600"
                    />
                    <div
                      v-else
                      class="size-2 bg-blue-600 rounded-full animate-pulse"
                    />
                  </div>
                  <h3 class="truncate text-sm font-medium text-zinc-100">
                    {{ task.name }}
                  </h3>
                  <RelativeTime
                    class="text-zinc-500"
                    :date="task.ended"
                  />
                </div>
                <p class="mt-1 truncate text-sm text-zinc-400">
                  {{ task.log.at(-1) }}
                </p>
                <NuxtLink
                  type="button"
                  :href="`/admin/task/${task.id}`"
                  class="mt-3 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
                >
                  View &rarr;
                </NuxtLink>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div>
        <h2 class="text-sm font-medium text-zinc-400">Daily scheduled tasks</h2>
        <ul role="list" class="mt-4 grid grid-cols-1 gap-6">
          <li
            v-for="task in dailyTasks"
            :key="task"
            class="col-span-1 divide-y divide-gray-200 rounded-lg bg-zinc-800 border border-zinc-700 shadow-sm"
          >
            <div class="flex w-full items-center justify-between space-x-6 p-6">
              <div class="flex-1 truncate">
                <div class="flex items-center space-x-2">
                  <h3 class="truncate text-sm font-medium text-zinc-100">
                    {{ dailyScheduledTasks[task].name }}
                  </h3>
                </div>
                <p class="mt-1 truncate text-sm text-zinc-400">
                  {{ dailyScheduledTasks[task].description }}
                </p>
                <button
                  type="button"
                  class="mt-3 inline-flex items-center gap-x-1 rounded-md px-1 py-0.5 text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
                >
                  <PlayIcon class="size-3" />
                  Trigger
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
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { PlayIcon } from "@heroicons/vue/24/solid";
import type { TaskGroup } from "~/server/internal/tasks/group";

useHead({
  title: "Tasks",
});

definePageMeta({
  layout: "admin",
});

const { runningTasks, historicalTasks, dailyTasks } =
  await $dropFetch("/api/v1/admin/task");

const liveRunningTasks = await Promise.all(runningTasks.map((e) => useTask(e)));

const dailyScheduledTasks: {
  [key in TaskGroup]: { name: string; description: string };
} = {
  "cleanup:invitations": {
    name: "Clean up invitations",
    description:
      "Cleans up expired invitations from the database to save space.",
  },
  "cleanup:objects": {
    name: "Clean up objects",
    description:
      "Detects and deletes unreferenced and unused objects to save space.",
  },
  "cleanup:sessions": {
    name: "Clean up sessions.",
    description:
      "Cleans up expired sessions to save space and ensure security.",
  },
  "check:update": {
    name: "Check update",
    description: "Check if Drop has an update.",
  },
  "import:game": {
    name: "",
    description: "",
  },
  debug: {
    name: "Debug",
    description: "DA BUG is gone I swear",
  },
};
</script>
