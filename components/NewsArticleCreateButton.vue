<template>
  <div class="w-full">
    <!-- Create article button - only show for admin users -->
    <button
      v-if="user?.admin"
      class="transition inline-flex w-full items-center px-4 gap-x-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm shadow-sm"
      @click="modalOpen = !modalOpen"
    >
      <PlusIcon
        class="h-5 w-5 transition-transform duration-200"
        :class="{ 'rotate-90': modalOpen }"
      />
      <span>New article</span>
    </button>

    <ModalTemplate v-model="modalOpen" size-class="sm:max-w-[80vw]">
      <h3 class="text-lg font-semibold text-zinc-100 mb-4">
        Create New Article
      </h3>
      <form class="space-y-4" @submit.prevent="() => createArticle()">
        <div>
          <label for="title" class="block text-sm font-medium text-zinc-400"
            >Title</label
          >
          <input
            id="title"
            v-model="newArticle.title"
            type="text"
            autocomplete="off"
            class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            required
          >
        </div>

        <div>
          <label for="excerpt" class="block text-sm font-medium text-zinc-400"
            >Short description</label
          >
          <input
            id="excerpt"
            v-model="newArticle.description"
            type="text"
            class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            required
          >
        </div>

        <div>
          <label for="content" class="block text-sm font-medium text-zinc-400"
            >Content (Markdown)</label
          >
          <div class="mt-1 flex flex-col gap-4">
            <!-- Markdown shortcuts -->
            <div class="flex flex-wrap gap-2">
              <button
                v-for="shortcut in markdownShortcuts"
                :key="shortcut.label"
                type="button"
                class="px-2 py-1 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                @click="applyMarkdown(shortcut)"
              >
                {{ shortcut.label }}
              </button>
            </div>

            <div
              class="grid grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 gap-4 h-[400px]"
            >
              <!-- Editor -->
              <div class="flex flex-col">
                <span class="text-sm text-zinc-500 mb-2">Editor</span>
                <textarea
                  id="content"
                  ref="contentEditor"
                  v-model="newArticle.content"
                  class="flex-1 rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 font-mono resize-none"
                  required
                  @keydown="handleContentKeydown"
                />
              </div>

              <!-- Preview -->
              <div class="flex flex-col">
                <span class="text-sm text-zinc-500 mb-2">Preview</span>
                <div
                  class="flex-1 p-4 rounded-md bg-zinc-900 border border-zinc-700 overflow-y-auto"
                >
                  <div
                    class="prose prose-invert prose-sm h-full overflow-y-auto"
                    v-html="markdownPreview"
                  />
                </div>
              </div>
            </div>
          </div>
          <p class="mt-2 text-sm text-zinc-500">
            Use the shortcuts above or write Markdown directly. Supports
            **bold**, *italic*, [links](url), and more.
          </p>
        </div>

        <div>
          <label
            for="file-upload"
            class="group cursor-pointer transition relative block w-full rounded-lg border-2 border-dashed border-zinc-600 p-12 text-center hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <ArrowUpTrayIcon
              class="transition mx-auto h-6 w-6 text-zinc-600 group-hover:text-zinc-700"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            />
            <span
              class="transition mt-2 block text-sm font-semibold text-zinc-400 group-hover:text-zinc-500"
              >Upload cover image</span
            >
            <p v-if="currentFile" class="mt-1 text-xs text-zinc-400">
              {{ currentFile.name }}
            </p>
          </label>
          <input
            id="file-upload"
            accept="image/*"
            class="hidden"
            type="file"
            @change="(e) => file = (e.target as any)?.files"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-zinc-400 mb-2"
            >Tags</label
          >
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="tag in newArticle.tags"
              :key="tag"
              class="inline-flex items-center gap-x-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-600/80 text-white"
            >
              {{ tag }}
              <button
                type="button"
                class="text-white hover:text-white/80"
                @click="removeTag(tag)"
              >
                <XMarkIcon class="h-3 w-3" />
              </button>
            </span>
          </div>
          <div class="flex gap-x-2">
            <input
              v-model="newTagInput"
              type="text"
              placeholder="Add a tag..."
              class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @keydown.enter.prevent="addTag"
            >
            <button
              type="button"
              class="mt-1 px-3 py-2 rounded-md bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              @click="addTag"
            >
              Add
            </button>
          </div>
        </div>

        <button type="submit" class="hidden" />

        <div v-if="error" class="mt-3 rounded-md bg-red-600/10 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-600">
                {{ error }}
              </h3>
            </div>
          </div>
        </div>
      </form>
      <template #buttons>
        <LoadingButton
          :loading="loading"
          class="bg-blue-600 text-white hover:bg-blue-500"
          @click="() => createArticle()"
        >
          Submit
        </LoadingButton>
        <button
          class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
          @click="() => (modalOpen = !modalOpen)"
        >
          Cancel
        </button>
      </template>
    </ModalTemplate>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowUpTrayIcon,
  PlusIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/vue/24/solid";
import type { Article } from "@prisma/client";
import { micromark } from "micromark";
import type { SerializeObject } from "nitropack/types";

const news = useNews();
if(!news.value){
  news.value = await fetchNews();
}

const user = useUser();

const modalOpen = ref(false);
const loading = ref(false);
const newTagInput = ref("");

const newArticle = ref({
  title: "",
  description: "",
  content: "",
  tags: [] as string[],
});

const markdownPreview = computed(() => {
  return micromark(newArticle.value.content);
});

const file = ref<FileList | undefined>();
const currentFile = computed(() => file.value?.item(0));

const error = ref<string | undefined>();

const contentEditor = ref<HTMLTextAreaElement>();

const markdownShortcuts = [
  { label: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
  { label: "Italic", prefix: "_", suffix: "_", placeholder: "italic text" },
  { label: "Link", prefix: "[", suffix: "](url)", placeholder: "link text" },
  { label: "Code", prefix: "`", suffix: "`", placeholder: "code" },
  { label: "List Item", prefix: "- ", suffix: "", placeholder: "list item" },
  { label: "Heading", prefix: "## ", suffix: "", placeholder: "heading" },
];

function handleContentKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();

    const textarea = contentEditor.value;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = textarea.value;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const currentLine = text.slice(lineStart, start);

    // Check if the current line starts with a list marker
    const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
    let insertion = "\n";

    if (listMatch) {
      // If the line is empty except for the list marker, end the list
      if (currentLine.trim() === listMatch[0].trim()) {
        const removeLength = currentLine.length;
        newArticle.value.content =
          text.slice(0, lineStart) + text.slice(lineStart + removeLength);

        // Move cursor to new position after removing the list marker
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = lineStart;
        });
        return;
      }
      // Otherwise, continue the list
      insertion = "\n" + listMatch[1] + listMatch[2] + " ";
    }

    newArticle.value.content =
      text.slice(0, start) + insertion + text.slice(start);

    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd =
        start + insertion.length;
    });
  }
}

function addTag() {
  const tag = newTagInput.value.trim();
  if (tag && !newArticle.value.tags.includes(tag)) {
    newArticle.value.tags.push(tag);
    newTagInput.value = ""; // Clear the input
  }
}

function removeTag(tagToRemove: string) {
  newArticle.value.tags = newArticle.value.tags.filter(
    (tag) => tag !== tagToRemove
  );
}

function applyMarkdown(shortcut: (typeof markdownShortcuts)[0]) {
  const textarea = contentEditor.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  const selectedText = text.substring(start, end);
  const replacement = selectedText || shortcut.placeholder;

  const newText =
    text.substring(0, start) +
    shortcut.prefix +
    replacement +
    shortcut.suffix +
    text.substring(end);

  newArticle.value.content = newText;

  nextTick(() => {
    textarea.focus();
    const newStart = start + shortcut.prefix.length;
    const newEnd = newStart + replacement.length;
    textarea.setSelectionRange(newStart, newEnd);
  });
}

async function createArticle() {
  if (!user.value) return;

  loading.value = true;
  try {
    const formData = new FormData();

    if (currentFile.value) {
      formData.append("image", currentFile.value);
    }

    formData.append("title", newArticle.value.title);
    formData.append("description", newArticle.value.description);
    formData.append("content", newArticle.value.content);
    formData.append("tags", JSON.stringify(newArticle.value.tags));

    const createdArticle = await $dropFetch("/api/v1/admin/news", {
      method: "POST",
      body: formData,
    });

    news.value?.push(createdArticle);

    // Reset form
    newArticle.value = {
      title: "",
      description: "",
      content: "",
      tags: [],
    };

    modalOpen.value = false;
  } catch (e) {
    error.value = (e as any)?.statusMessage ?? "An unknown error occured.";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
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
