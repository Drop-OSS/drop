<!-- eslint-disable vue/no-v-html -->
<template>
  <div
    class="flex grow flex-col gap-y-5 overflow-y-auto bg-zinc-900 px-6 py-6 ring-1 ring-white/10"
  >
    <!-- Search and filters -->
    <div class="space-y-6">
      <div>
        <label for="search" class="sr-only">Search articles</label>
        <div class="relative">
          <div
            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
          >
            <MagnifyingGlassIcon
              class="h-5 w-5 text-zinc-400"
              aria-hidden="true"
            />
          </div>
          <input
            id="search"
            v-model="searchQuery"
            type="text"
            class="block w-full rounded-md border-0 bg-zinc-800 py-2.5 pl-10 pr-3 text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
            placeholder="Search articles..."
          />
        </div>
      </div>

      <div class="pt-2">
        <label for="date" class="block text-sm font-medium text-zinc-400 mb-2"
          >Date</label
        >
        <select
          id="date"
          v-model="dateFilter"
          class="mt-1 block w-full rounded-md border-0 bg-zinc-800 py-2 pl-3 pr-10 text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
        </select>
      </div>

      <!-- Tags -->
      <div>
        <label class="block text-sm font-medium text-zinc-400 mb-2">Tags</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in availableTags"
            :key="tag"
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-200"
            :class="[
              selectedTags.includes(tag)
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
            ]"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </div>

    <nav class="flex-1 space-y-2">
      <NuxtLink
        v-for="article in filteredArticles"
        :key="article.id"
        :to="`/news/${article.id}`"
        class="group block rounded-lg hover-lift"
      >
        <div
          class="relative flex flex-col gap-y-2 rounded-lg p-3 transition-all duration-200"
          :class="[
            route.params.id === article.id
              ? 'bg-zinc-800'
              : 'hover:bg-zinc-800/50',
          ]"
        >
          <div
            v-if="article.imageObjectId"
            class="absolute inset-0 rounded-lg transition-all duration-200 overflow-hidden"
          >
            <img
              :src="useObject(article.imageObjectId)"
              class="absolute blur-sm inset-0 w-full h-full object-cover transition-all duration-200 group-hover:scale-110"
            />
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-800 transition-all duration-200"
            />
          </div>

          <h3 class="relative text-sm font-medium text-zinc-100">
            {{ article.title }}
          </h3>
          <p
            class="relative mt-1 text-xs text-zinc-400 line-clamp-2"
            v-html="formatExcerpt(article.description)"
          />
          <div
            class="relative mt-2 flex items-center gap-x-2 text-xs text-zinc-500"
          >
            <time :datetime="article.publishedAt">{{
              formatDate(article.publishedAt)
            }}</time>
          </div>
        </div>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { MagnifyingGlassIcon } from "@heroicons/vue/24/solid";
import { micromark } from "micromark";

const news = useNews();
if (!news.value) {
  news.value = await fetchNews();
}

const route = useRoute();
const searchQuery = ref("");
const dateFilter = ref("all");
const selectedTags = ref<string[]>([]);

// Get unique tags from all articles
const availableTags = computed(() => {
  if (!news.value) return [];
  const tags = new Set<string>();
  news.value.forEach((article) => {
    article.tags.forEach((tag) => tags.add(tag.name));
  });
  return Array.from(tags);
});

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag);
  if (index === -1) {
    selectedTags.value.push(tag);
  } else {
    selectedTags.value.splice(index, 1);
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatExcerpt = (excerpt: string) => {
  // TODO: same as one in NewsArticleCreateButton
  // Convert markdown to HTML
  const html = micromark(excerpt);
  // Strip HTML tags using regex
  return html.replace(/<[^>]*>/g, "");
};

const filteredArticles = computed(() => {
  if (!news.value) return [];

  // filter articles based on search, date, and tags
  return news.value.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      article.description
        .toLowerCase()
        .includes(searchQuery.value.toLowerCase());

    const articleDate = new Date(article.publishedAt);
    const now = new Date();
    let matchesDate = true;

    switch (dateFilter.value.toLowerCase()) {
      case "today": {
        matchesDate = articleDate.toDateString() === now.toDateString();
        break;
      }
      case "week": {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        matchesDate = articleDate >= weekAgo;
        break;
      }
      case "month": {
        matchesDate =
          articleDate.getMonth() === now.getMonth() &&
          articleDate.getFullYear() === now.getFullYear();
        break;
      }
      case "year": {
        matchesDate = articleDate.getFullYear() === now.getFullYear();
        break;
      }
    }

    const matchesTags =
      selectedTags.value.length === 0 ||
      selectedTags.value.every((tag) =>
        article.tags.find((e) => e.name == tag),
      );

    return matchesSearch && matchesDate && matchesTags;
  });
});
</script>

<style scoped>
.hover-lift {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hover-lift:hover {
  transform: translateY(-2px) scale(1.02);
}
</style>
