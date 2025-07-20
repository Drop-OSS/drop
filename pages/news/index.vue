<template>
  <div class="flex flex-col px-8">
    <div class="mb-8">
      <div class="flex flex-col gap-y-4">
        <div>
          <h2 class="text-2xl font-bold font-display text-zinc-100">
            {{ $t("news.title") }}
          </h2>
          <p class="mt-2 text-zinc-400">
            {{ $t("news.subheader") }}
          </p>
        </div>
      </div>
    </div>

    <!-- Articles list -->
    <TransitionGroup name="article-list" tag="div" class="gap-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              :src="article.imageObjectId ? useObject(article.imageObjectId) : '/wallpapers/news-placeholder.jpg'"
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
                  {{ $d(new Date(article.publishedAt), "short") }}
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
      <h3 class="mt-2 text-sm font-semibold text-zinc-100">
        {{ $t("news.none") }}
      </h3>
      <p class="mt-1 text-sm text-zinc-500">{{ $t("news.checkLater") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DocumentIcon } from "@heroicons/vue/24/outline";
import type { Article } from "~/prisma/client";
import type { SerializeObject } from "nitropack/types";

const { t } = useI18n();

const { articles } = defineProps<{
  articles: SerializeObject<
    Article & {
      tags: Array<{ name: string; id: string }>;
      author: { displayName: string };
    }
  >[];
}>();

useHead({
  title: t("userHeader.links.news"),
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
