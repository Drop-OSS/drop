<template>
  <div
    v-if="task"
    class="flex w-full items-center justify-between space-x-6 p-6"
  >
    <div class="flex-1 truncate">
      <div class="flex items-center space-x-1">
        <div>
          <CheckCircleIcon v-if="task.success" class="size-5 text-green-600" />
          <XMarkIcon v-else-if="task.error" class="size-5 text-red-600" />
          <div v-else class="size-2 bg-blue-600 rounded-full animate-pulse m-1" />
        </div>
        <h3 class="truncate text-sm font-medium text-zinc-100">
          {{ task.name }}
        </h3>
      </div>
      <div
        v-if="active"
        class="mt-2 w-full rounded-full overflow-hidden bg-zinc-900"
      >
        <div
          :style="{ width: `${task.progress}%` }"
          class="bg-blue-600 h-[3px] transition-all"
        />
      </div>
      <div class="mt-2 bg-zinc-950 px-2 pb-1 rounded-sm">
        <LogLine :short="true" :log="parseTaskLog(task.log.at(-1))" />
      </div>
      <NuxtLink
        type="button"
        :href="`/admin/task/${task.id}`"
        class="mt-3 ml-1 rounded-md text-xs font-medium text-zinc-100 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 focus:ring-offset-2"
      >
        <i18n-t keypath="tasks.admin.viewTask" tag="span" scope="global">
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
</template>

<script setup lang="ts">
import { CheckCircleIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import type { TaskMessage } from "~/server/internal/tasks";

defineProps<{ task: TaskMessage | undefined; active?: boolean }>();
</script>
