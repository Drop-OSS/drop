<template>
  <div class="flex flex-row h-full">
    <!-- Sidebar -->
    <div
      class="flex-none max-h-full overflow-y-auto w-72 bg-surface-950/50 backdrop-blur-xl px-4 py-3 border-r border-surface-800/50"
    >
      <LibrarySearch />
    </div>

    <div class="grow overflow-y-auto">
      <NuxtErrorBoundary>
        <NuxtPage />
        <template #error="{ error }">
          <main
            class="grid min-h-full w-full place-items-center px-6 py-24 sm:py-32 lg:px-8"
          >
            <div class="text-center">
              <p class="text-base font-semibold text-accent-600">Error</p>
              <h1
                class="mt-4 text-3xl font-bold font-display tracking-tight text-ink-100 sm:text-5xl"
              >
                Failed to load library
              </h1>
              <p class="mt-6 text-base leading-7 text-ink-400">
                Drop couldn't load your library: "{{ error }}".
              </p>
            </div>
          </main>
        </template>
      </NuxtErrorBoundary>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-leave-active {
  position: absolute;
}
</style>
