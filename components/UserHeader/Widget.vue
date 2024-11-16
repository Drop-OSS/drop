<template>
  <div
    :class="[
      'transition inline-flex items-center justify-center cursor-pointer rounded-sm px-4 py-2 relative',
      showNotifications
        ? 'bg-blue-300 text-zinc-900 hover:bg-blue-200 hover:text-zinc-950'
        : 'bg-zinc-900 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300',
    ]"
  >
    <slot />
    <TransitionRoot
      :show="showNotifications"
      enter="ease-out duration-150"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in duration-150"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div
        class="w-4 h-4 absolute top-0 right-0 translate-x-[30%] translate-y-[-30%] rounded-full bg-blue-300 inline-flex items-center justify-center text-xs text-zinc-900 font-bold"
      >
        {{ props.notifications }}
      </div>
    </TransitionRoot>
  </div>
</template>

<script setup lang="ts">
import { TransitionRoot } from "@headlessui/vue";

const props = defineProps<{
  notifications?: number;
}>();

const showNotifications = computed(() => !!props.notifications);
</script>
