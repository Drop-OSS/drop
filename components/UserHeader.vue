<template>
    <div class="bg-gray-950 flex flex-row px-48 py-5">
        <div class="grow inline-flex items-center gap-x-20">
            <Wordmark class="h-8" />
            <nav class="inline-flex items-center">
                <ol class="inline-flex items-center gap-x-12 mt-1">
                    <li class="transition text-gray-300 hover:text-gray-100 uppercase font-display font-semibold text-md"
                        v-for="(nav, navIdx) in navigation">
                        {{ nav.label }}
                    </li>
                </ol>
            </nav>
        </div>
        <div class="inline-flex items-center">
            <ol class="inline-flex gap-3">
                <li v-for="(item, itemIdx) in quickActions">
                    <InlineWidget @click="item.action" :notifications="item.notifications">
                        <component class="h-5" :is="item.icon" />
                    </InlineWidget>
                </li>
                <InlineUserWidget />
            </ol>
        </div>
    </div>
</template>

<script setup lang="ts">
import { BellIcon, UserGroupIcon } from '@heroicons/vue/16/solid';
import type { NavigationItem, QuickActionNav } from './types';


const navigation: Array<NavigationItem> = [
    {
        prefix: '/store',
        route: '/store',
        label: "Store"
    },
    {
        prefix: "/library",
        route: "/library",
        label: "Library"
    },
    {
        prefix: "/community",
        route: "/community",
        label: "Community"
    },
    {
        prefix: "/news",
        route: "/news",
        label: "News"
    }
]

const quickActions: Array<QuickActionNav> = [
    {
        icon: UserGroupIcon,
        action: async () => { }
    },
    {
        icon: BellIcon,
        action: async () => { }
    }
]

</script>