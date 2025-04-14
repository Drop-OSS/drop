<template>
  <div
    v-if="task && task.success"
    class="grow w-full flex items-center justify-center"
  >
    <div class="flex flex-col items-center">
      <CheckCircleIcon class="h-12 w-12 text-green-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          Successful!
        </h1>
        <div class="mt-4">
          <p class="text-sm text-zinc-400 max-w-md">
            "{{ task.name }}" completed successfully.
          </p>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else-if="task && task.error"
    class="grow w-full flex items-center justify-center"
  >
    <div class="flex flex-col items-center">
      <ExclamationCircleIcon
        class="h-12 w-12 text-red-600"
        aria-hidden="true"
      />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          {{ task.error.title }}
        </h1>
        <div class="mt-4">
          <p class="text-sm text-zinc-400 max-w-md">
            {{ task.error.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="task" class="flex flex-col w-full gap-y-4">
    <h1 class="text-3xl text-zinc-100 font-bold font-display">
      {{ task.name }}
    </h1>
    <div class="h-3 rounded-full bg-zinc-950 overflow-hidden">
      <div
        :style="{ width: `${task.progress}%` }"
        class="transition-all bg-blue-600 h-full"
      />
    </div>

    <div class="bg-zinc-950/50 rounded-md p-2 text-zinc-100">
      <pre v-for="(line, idx) in task.log" :key="idx">{{ line }}</pre>
    </div>
  </div>
  <div
    v-else
    role="status"
    class="w-full h-screen flex items-center justify-center"
  >
    <svg
      aria-hidden="true"
      class="size-8 text-transparent animate-spin fill-white"
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
    <span class="sr-only">Loading...</span>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleIcon } from "@heroicons/vue/16/solid";
import { ExclamationCircleIcon, XMarkIcon } from "@heroicons/vue/24/solid";

const route = useRoute();
const taskId = route.params.id.toString();

const task = useTask(taskId);

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Task",
});
</script>
