<template>
  <div class="flex flex-col max-w-4xl mx-auto">
    <div class="mb-8">
      <div class="flex flex-col gap-y-4">
        <div>
          <h2 class="text-2xl font-bold font-display text-zinc-100">
            Latest News
          </h2>
          <p class="mt-2 text-zinc-400">
            Stay up to date with the latest updates and announcements.
          </p>
        </div>
      </div>
    </div>

    <!-- Articles list -->
    <TransitionGroup name="article-list" tag="div" class="space-y-6">
      <NuxtLink
        v-for="article in articles"
        :key="article.id"
        :to="`/news/${article.id}`"
        class="block"
      >
        <article
          class="group relative flex flex-col overflow-hidden rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-200"
        >
          <div class="relative h-48 w-full overflow-hidden">
            <img
              v-if="article.image"
              :src="useObject(article.image)"
              alt=""
              class="h-full w-full object-cover object-center transition-all duration-500 group-hover:scale-110 scale-105"
            />
            <div class="absolute top-4 left-4 flex gap-2">
              <span
                v-for="tag in article.tags"
                :key="tag.id"
                class="inline-flex items-center rounded-full bg-zinc-900/75 px-3 py-1 text-sm font-semibold text-zinc-100 backdrop-blur"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>

          <div class="flex flex-1 flex-col justify-between p-6">
            <div class="flex-1">
              <div class="flex items-center gap-x-2">
                <time
                  :datetime="article.publishedAt"
                  class="text-sm text-zinc-400"
                >
                  {{ formatDate(article.publishedAt) }}
                </time>
                <span class="text-sm text-blue-400">{{
                  article.author?.displayName ?? "System"
                }}</span>
              </div>
              <div class="mt-2">
                <h3
                  class="text-xl font-semibold text-zinc-100 group-hover:text-primary-400"
                >
                  {{ article.title }}
                </h3>
                <p class="mt-3 text-base text-zinc-400">
                  {{ article.description }}
                </p>
              </div>
            </div>
          </div>
        </article>
      </NuxtLink>
    </TransitionGroup>

    <div v-if="articles?.length === 0" class="text-center py-12">
      <DocumentIcon class="mx-auto h-12 w-12 text-zinc-400" />
      <h3 class="mt-2 text-sm font-semibold text-zinc-100">No articles</h3>
      <p class="mt-1 text-sm text-zinc-500">Check back later for updates.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DocumentIcon } from "@heroicons/vue/24/outline";
import type { Article } from "@prisma/client";
import type { SerializeObject } from "nitropack/types";

const props = defineProps<{
  articles: SerializeObject<
    Article & {
      tags: Array<{ name: string; id: string }>;
      author: { displayName: string };
    }
  >[];
}>();

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

useHead({
  title: "News",
});
</script>

<style scoped>
/* Article list transitions */
.article-list-enter-active,
.article-list-leave-active {
  transition: all 0.5s ease;
}

.article-list-enter-from,
.article-list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.article-list-move {
  transition: transform 0.5s ease;
}
</style>
