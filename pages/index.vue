<template>
    <div class="px-12 py-4">
        <h1 class="text-zinc-100 text-2xl font-bold font-display">
            Newly added
        </h1>
        <NuxtLink class="text-blue-600 font-semibold"
            >Explore more &rarr;</NuxtLink
        >
        <div class="mt-4 grid grid-cols-8 gap-x-8 w-max">
            <GamePanel v-for="i in 8" :game="games[i - 1]" />
        </div>
    </div>
</template>

<script setup lang="ts">
useHead({
    title: "Home",
});

const headers = useRequestHeaders(["cookie"]);
const games = await $fetch("/api/v1/games/front", { headers });
</script>
