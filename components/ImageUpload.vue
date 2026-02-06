<template>
  <div
    class="relative group/iconupload rounded-xl overflow-hidden w-20 mx-auto"
  >
    <img v-if="objectId" :src="useObject(objectId)" :alt="imageAlt" />
    <ArrowUpTrayIcon v-else />
    <button
      type="button"
      class="rounded-xl transition duration-200 absolute inset-0 opacity-0 group-hover/iconupload:opacity-100 focus-visible/iconupload:opacity-100 cursor-pointer bg-zinc-900/80 text-zinc-100 flex flex-col items-center justify-center text-center text-xs font-semibold ring-1 ring-inset ring-zinc-800 px-2"
      @click="openModal"
    >
      <ArrowUpTrayIcon class="size-5" />
      <span>{{ hoverText }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ArrowUpTrayIcon } from "@heroicons/vue/24/solid";

const { objectId, openModal, hoverText, imageAlt } = defineProps<{
  objectId: string | null;
  openModal: () => void;
  hoverText: string;
  imageAlt: string;
}>();
</script>
