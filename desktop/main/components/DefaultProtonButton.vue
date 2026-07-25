<script setup lang="ts">
import { StarIcon } from "@heroicons/vue/24/solid";
import { invoke } from "@tauri-apps/api/core";

const props = defineProps<{
  path?: string;
}>();

const model = defineModel<string | undefined>({ required: true });

const isDefault = computed(() => props.path == model.value);

async function setDefault() {
  if (!props.path) return;
  await invoke("set_default", { path: props.path });
  model.value = props.path;
}
</script>

<template>
  <button
    type="button"
    :class="['p-0.5 rounded-full', isDefault ? 'bg-blue-500' : 'bg-zinc-800']"
    @click="setDefault"
    :disabled="!props.path"
  >
    <StarIcon :class="['size-[0.7rem]', isDefault ? 'text-zinc-100' : 'text-zinc-100']" />
  </button>
</template>
