<template>
  <div class="w-full flex flex-col px-4 sm:px-12 py-4 gap-y-8">
    <!-- Welcome section -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold font-display text-zinc-100">
          Welcome back, {{ user?.displayName }}
        </h1>
        <p class="mt-1 text-zinc-400">Your Drop dashboard</p>
      </div>
      <NuxtLink
        to="/store"
        class="hidden sm:flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 hover:scale-105 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Browse Store
        <ArrowRightIcon class="h-5 w-5" />
      </NuxtLink>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Library Overview -->
      <div class="lg:col-span-2 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold font-display text-zinc-100">
            Recently Added Games to your Library
          </h2>
          <NuxtLink 
            to="/library" 
            class="text-blue-600 font-semibold text-sm hover:text-blue-400 transition-colors duration-200"
          >
            View All &rarr;
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="game in recentGames"
            :key="game.id"
            class="bg-zinc-900/50 rounded-lg p-4 group hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-zinc-900/20 transition-all duration-200"
          >
            <div class="flex gap-4">
              <img 
                :src="useObject(game.mCoverId)" 
                class="h-24 w-16 object-cover rounded flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
                alt=""
              />
              <div class="flex flex-col gap-2">
                <div>
                  <h3 class="text-sm font-medium text-zinc-100 truncate group-hover:text-blue-400 transition-colors duration-200">
                    {{ game.mName }}
                  </h3>
                  <p class="text-sm text-zinc-500 line-clamp-2 group-hover:text-zinc-400 transition-colors duration-200">
                    {{ game.mShortDescription }}
                  </p>
                </div>
                <div>
                  <NuxtLink
                    :to="`/store/${game.id}`"
                    class="inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 hover:scale-105 transition-all duration-200"
                  >
                    View Details
                    <ArrowRightIcon class="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Account Overview -->
      <div class="space-y-4">
        <h2 class="text-xl font-semibold font-display text-zinc-100">
          Account Overview
        </h2>
        <dl class="grid grid-cols-1 gap-4">
          <div class="bg-zinc-900/50 px-4 py-5 rounded-lg sm:p-6 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-zinc-900/20 transition-all duration-200">
            <dt class="text-sm font-medium text-zinc-400">Games in Library</dt>
            <dd class="mt-1 flex items-baseline justify-between md:block lg:flex">
              <div class="flex items-baseline text-2xl font-semibold text-zinc-100">
                {{ games.length }}
                <span class="ml-2 text-sm font-medium text-zinc-400">games</span>
              </div>
            </dd>
          </div>
          <div class="bg-zinc-900/50 px-4 py-5 rounded-lg sm:p-6 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-zinc-900/20 transition-all duration-200">
            <dt class="text-sm font-medium text-zinc-400">Account Type</dt>
            <dd class="mt-1 flex items-baseline justify-between md:block lg:flex">
              <div class="flex items-baseline text-2xl font-semibold text-zinc-100">
                {{ user?.admin ? 'Administrator' : 'User' }}
              </div>
            </dd>
          </div>
          <NuxtLink 
            to="/account"
            class="block w-full text-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 hover:scale-105 transition-all duration-200"
          >
            Manage Account Settings
          </NuxtLink>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowRightIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { type Game } from '@prisma/client'

const user = useUser();
const headers = useRequestHeaders(["cookie"]);

// Fetch data
const games = await $fetch<Game[]>("/api/v1/store/recent", { headers });

// Get the 4 most recently updated games
const recentGames = [...games]
  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  .slice(0, 4);

useHead({
  title: "Dashboard",
});
</script>
