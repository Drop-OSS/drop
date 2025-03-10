<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Banner header with blurred background -->
    <div class="relative w-full h-[300px] mb-8 rounded-lg overflow-hidden">
      <div class="absolute inset-0">
        <template v-if="article.image">
          <img
            :src="article.image"
            alt=""
            class="w-full h-full object-cover blur-sm scale-110"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/60 to-zinc-950/90"></div>
        </template>
        <template v-else>
          <!-- Fallback gradient background when no image -->
          <div class="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900"></div>
        </template>
      </div>

      <div class="relative h-full flex flex-col justify-end p-8">
        <div class="flex items-center gap-x-3 mb-6">
          <NuxtLink
            to="/news"
            class="px-2 py-1 rounded bg-zinc-900/80 backdrop-blur-sm transition text-sm/6 font-semibold text-zinc-400 hover:text-zinc-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
          >
            <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to News
          </NuxtLink>
          
          <button
            v-if="user?.admin"
            @click="() => currentlyDeleting = article"
            class="px-2 py-1 rounded bg-red-900/50 backdrop-blur-sm transition text-sm/6 font-semibold text-red-400 hover:text-red-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
          >
            <TrashIcon class="h-4 w-4" aria-hidden="true" />
            Delete Article
          </button>
        </div>

        <div class="max-w-[calc(100%-2rem)]">
          <h1 class="text-4xl font-bold text-white mb-3">{{ article.title }}</h1>
          <div class="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:gap-x-4 text-zinc-300">
            <div class="flex items-center gap-x-4">
              <time :datetime="article.publishedAt">{{ formatDate(article.publishedAt) }}</time>
              <span class="text-blue-400">{{ article.author.displayName }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in article.tags"
                :key="tag"
                class="inline-flex items-center rounded-full bg-zinc-800/80 backdrop-blur-sm px-3 py-1 text-sm font-semibold text-zinc-100"
              >
                {{ tag }}
              </span>
            </div>
          </div>
          <p class="mt-4 text-lg text-zinc-300">{{ article.excerpt }}</p>
        </div>
      </div>
    </div>

    <!-- Article content - markdown -->
    <div 
      class="max-w-[calc(100%-2rem)] mx-auto prose prose-invert prose-lg"
      v-html="renderedContent"
    />
  </div>

  <DeleteNewsModal v-model="currentlyDeleting" />
</template>

<script setup lang="ts">
import { ArrowLeftIcon } from "@heroicons/vue/20/solid";
import { TrashIcon } from "@heroicons/vue/24/outline";
import { micromark } from 'micromark';

const route = useRoute();
const { data: article } = await useNews().getById(route.params.id as string);
const currentlyDeleting = ref();
const user = useUser();

if (!article.value) {
  throw createError({
    statusCode: 404,
    message: 'Article not found'
  });
}

// Render markdown content
const renderedContent = computed(() => {
  return micromark(article.value.content);
});

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

useHead({
  title: article.value.title,
});
</script>

<style>
.prose {
  max-width: none;
}

.prose a {
  color: #60a5fa;
  text-decoration: none;
}

.prose a:hover {
  text-decoration: underline;
}

.prose img {
  border-radius: 0.5rem;
}

.prose code {
  background: #27272a;
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.prose pre {
  background: #18181b;
  padding: 1em;
  border-radius: 0.5rem;
}
</style>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
