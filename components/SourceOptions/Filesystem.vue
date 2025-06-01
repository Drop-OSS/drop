<template>
  <div>
    <label for="path" class="block text-sm font-medium leading-6 text-zinc-100"
      >Path</label
    >
    <p class="text-zinc-400 block text-xs font-medium leading-6">
      An absolute path to your game library.
    </p>
    <div class="mt-2">
      <input
        id="path"
        v-model="model!.baseDir"
        name="path"
        type="text"
        autocomplete="path"
        placeholder="/mnt/games"
        class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const model = defineModel<{ baseDir: string }>();
</script>
