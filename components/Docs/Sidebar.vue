<template>
    <div
        v-if="user"
        class="flex grow flex-col gap-y-5 overflow-y-auto bg-zinc-900 px-6 pb-4 ring-1 ring-white/10"
    >
        <div class="flex h-16 shrink-0 items-center">
            <Wordmark />
        </div>

        <nav class="flex flex-1 flex-col">
            <ul role="list" class="flex flex-1 flex-col gap-y-7">
                <li>
                    <ul role="list" class="-mx-2 space-y-1">
                        <DocsSidebarNavItem
                            v-for="item in unwrappedNavigation ?? navigation"
                            :key="item.name"
                            :nav="item"
                        />
                    </ul>
                </li>
                <li class="mt-auto flex items-center">
                    <div class="inline-flex items-center w-full text-zinc-300">
                        <img
                            :src="useObject(user.profilePicture)"
                            class="w-5 h-5 rounded-sm"
                        />
                        <span class="ml-3 text-sm font-bold">{{
                            user.displayName
                        }}</span>
                    </div>
                    <NuxtLink
                        href="/"
                        class="ml-auto rounded bg-blue-600 px-2 py-1 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        &larr;&nbsp;Home
                    </NuxtLink>
                </li>
            </ul>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { fetchContentNavigation, useObject, useUser } from "#imports";

const user = useUser();

const navigation = await fetchContentNavigation();
const unwrappedNavigation = navigation[0]?.children;
</script>
