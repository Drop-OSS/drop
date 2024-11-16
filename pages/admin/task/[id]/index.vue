<template>
  <div
    class="grow w-full flex items-center justify-center"
    v-if="taskValue && taskValue.success"
  >
    <div class="flex flex-col items-center">
      <CheckCircleIcon class="h-12 w-12 text-green-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          Successful!
        </h1>
        <div class="mt-4">
          <p class="text-sm text-zinc-400 max-w-md">
            "{{ taskValue.name }}" completed successfully.
          </p>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="taskValue" class="flex flex-col w-full gap-y-4">
    <h1 class="text-3xl text-zinc-100 font-bold font-display">
      {{ taskValue.name }}
    </h1>
    <div class="h-3 rounded-full bg-zinc-950 overflow-hidden">
      <div
        :style="{ width: `${taskValue.progress}%` }"
        class="transition-all bg-blue-600 h-full"
      />
    </div>

    <div class="bg-zinc-950/50 rounded-md p-2 text-zinc-100">
      <pre v-for="line in taskValue.log">{{ line }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/16/solid';

const route = useRoute();
const taskId = route.params.id.toString();

const task = useTask(taskId);
const taskValue = computed(() => task.value);

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Task",
});
</script>
