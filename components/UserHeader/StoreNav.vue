<template>
  <div
    class="w-full bg-zinc-950 p-1 inline-flex items-center gap-x-2 fixed inset-x-0 top-0 z-100"
  >
    <button
      class="p-1 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-all rounded"
      @click="() => router.back()"
    >
      <ChevronLeftIcon class="size-4" />
    </button>
    <button
      class="p-1 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-all rounded"
      @click="() => router.forward()"
    >
      <ChevronRightIcon class="size-4" />
    </button>
    <span class="text-zinc-400 text-sm">
      {{ title }}
    </span>
  </div>
</template>
<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/vue/24/outline";

const router = useRouter();
const title = ref("Loading...");

onMounted(() => {
  title.value = document.title;
});

router.afterEach(() => {
  title.value = "Loading...";
  // TODO: more robust after-render "detection"
  setTimeout(() => {
    title.value = document.title;
  }, 500);
});
</script>
