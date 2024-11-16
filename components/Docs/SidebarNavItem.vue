<template>
    <NuxtLink
        :href="props.nav._path"
        :class="[
            current
                ? 'text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900',
            ' group flex gap-x-3 rounded-md px-2 text-sm font-semibold leading-6',
        ]"
    >
        {{ props.nav.title }}
    </NuxtLink>
    <ul class="pl-3 flex flex-col" v-if="children">
        <li v-for="child in children" class="inline-flex items-center">
            <ChevronDownIcon class="w-4 h-4 text-zinc-600 rotate-45" />
            <DocsSidebarNavItem :nav="child" :key="child._path" />
        </li>
    </ul>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from "@heroicons/vue/24/solid";

type NavItem = { title: string; _path: string; children?: NavItem[] };
const props = defineProps<{ nav: NavItem }>();
const children = props.nav.children?.filter((e) => e._path != props.nav._path);

const route = useRoute();
const current = computed(() => route.path.trim() == props.nav._path.trim());
</script>
