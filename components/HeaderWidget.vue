<template>
    <div class="transition inline-flex items-center justify-center cursor-pointer rounded-sm px-4 py-2 bg-zinc-900 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 relative">
        <slot />
        <div v-if="props.notifications !== undefined"
            class="text-zinc-900 absolute top-0 right-0 translate-x-[30%] translate-y-[-30%] text-xs bg-blue-300 rounded-full w-3.5 h-3.5 text-center">
            {{ props.notifications }}
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    notifications?: number
}>();


</script>