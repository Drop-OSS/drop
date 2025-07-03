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
              <p class="text-xs text-zinc-600 mt-0.5 font-mono">
                {{ task.value.id }}
              </p>
              <div class="mt-1 w-full rounded-full overflow-hidden bg-zinc-900">
                <div
                  :style="{ width: `${task.value.progress}%` }"
                  class="bg-blue-600 h-1.5 transition-all"
                />
              </div>
              <p class="mt-1 truncate text-sm text-zinc-400">
                {{ parseTaskLog(task.value.log.at(-1)).message }}
              </p>
              <NuxtLink
                type="button"
                :href="`/admin/task/${task.value.id}`"
                class="mt-3 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
              >
                <i18n-t
                  keypath="tasks.admin.viewTask"
                  tag="span"
                  scope="global"
                >
                  <template #arrow>
                    <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                  </template>
                </i18n-t>
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
                  <RelativeTime class="text-zinc-500" :date="task.ended" />
                </div>
                <p class="text-xs text-zinc-600 mt-0.5 font-mono">
                  {{ task.id }}
                </p>
                <p class="mt-1 truncate text-sm text-zinc-400">
                  {{ parseTaskLog(task.log.at(-1)).message }}
                </p>
                <NuxtLink
                  type="button"
                  :href="`/admin/task/${task.id}`"
                  class="mt-3 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
                >
                  <i18n-t
                    keypath="tasks.admin.viewTask"
                    tag="span"
                    scope="global"
                  >
                    <template #arrow>
                      <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                    </template>
                  </i18n-t>
                </NuxtLink>
              </div>
            </div>
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

const liveRunningTasks = await Promise.all(runningTasks.map((e) => useTask(e)));

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
  "ludusavi:import": {
    name: t("tasks.admin.scheduled.ludusaviImportName"),
    description: t("tasks.admin.scheduled.ludusaviImportDescription"),
  },
};
</script>
