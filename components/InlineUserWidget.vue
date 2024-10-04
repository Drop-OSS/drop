<template>
    <InlineWidget>
        <div class="inline-flex items-center text-zinc-300 hover:text-white">
            <img :src="userData.image" class="w-5 h-5 rounded-sm" />
            <span class="ml-2 -mb-1 text-sm">{{ userData.name }}</span>
            <ChevronDownIcon class="ml-3 h-4" />
        </div>
    </InlineWidget>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from '@heroicons/vue/16/solid';

const userData = {
    image: "https://avatars.githubusercontent.com/u/64579723?v=4",
    name: "DecDuck",
}
</script>