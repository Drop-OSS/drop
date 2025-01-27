<template>
  <div class="flex flex-row h-full">
    <!-- Left sidebar with game list -->
    <div class="w-64 min-w-64 border-r border-zinc-800 flex flex-col min-h-[75vh] h-full">
      <div class="flex-1 overflow-y-auto p-3">
        <h2 class="text-lg font-semibold tracking-tight text-zinc-100 mb-3">
          Your Library
        </h2>
        
        <!-- Search bar -->
        <div class="relative mb-3">
          <input
            type="text"
            name="search"
            id="search"
            autocomplete="off"
            class="block w-full rounded-md bg-zinc-900 py-1 pl-8 pr-2 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600"
            placeholder="Search library..."
            v-model="searchQuery"
          />
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
            aria-hidden="true"
          />
        </div>
        
        <TransitionGroup 
          name="list" 
          tag="ul" 
          role="list" 
          class="space-y-1 min-h-[calc(75vh-8rem)]"
        >
          <li v-for="game in filteredGames" :key="game.id" class="flex">
            <NuxtLink 
              :to="`/library/game/${game.id}`"
              class="flex flex-row items-center w-full p-1.5 rounded-md transition-all duration-200 hover:bg-zinc-800 hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
              :class="{ 'bg-zinc-800': route.params.id === game.id }"
            >
              <img 
                :src="useObject(game.mCoverId)"
                class="h-9 w-9 flex-shrink-0 rounded transition-all duration-300 group-hover:scale-105 hover:rotate-[-2deg] hover:shadow-lg"
                alt=""
              />
              <div class="min-w-0 flex-1 pl-2.5">
                <p class="text-xs font-medium text-zinc-100 truncate text-left">
                  {{ game.mName }}
                </p>
              </div>
            </NuxtLink>
          </li>
        </TransitionGroup>

        <p
          v-if="games.length === 0"
          class="text-zinc-600 text-sm font-display font-bold uppercase text-center mt-8"
        >
          No games in library
        </p>
      </div>
    </div>

    <!-- Main content area -->
    <div class="flex-1 overflow-y-auto h-full no-scrollbar">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
import { type Game, type GameVersion, type Collection } from "@prisma/client";
import { ref as vueRef } from 'vue';

const router = useRouter();
const route = useRoute();
const headers = useRequestHeaders(["cookie"]);
const { data: gamesData } = await useFetch<(Game & { versions: GameVersion[] })[]>("/api/v1/store/recent", { headers });
const games = ref(gamesData.value || []);

const selectedGame = ref<(Game & { versions: GameVersion[] }) | null>(null);
const searchQuery = ref("");

const filteredGames = computed(() => {
  if (!searchQuery.value) return games.value;
  const query = searchQuery.value.toLowerCase();
  return games.value.filter(game => 
    game.mName.toLowerCase().includes(query)
  );
});

const selectedGames = computed(() => {
  if (!selectedCollection.value?.entries) return [];
  return selectedCollection.value.entries.map(entry => entry.game);
});

useHead({
  title: "Library",
});
</script>

<style scoped>
/* Fade transition for main content */


/* List transition animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-move {
  transition: transform 0.3s ease;
}

/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}

.hover-lift {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hover-lift:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.2);
}

/* Springy list animations */
.list-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.list-leave-active {
  transition: all 0.3s ease;
}

.list-move {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style> 
