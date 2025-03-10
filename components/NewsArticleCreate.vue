<template>
  <div class="w-full">
    <!-- Create article button - only show for admin users -->
    <button
      v-if="user?.admin"
      @click="isCreateExpanded = !isCreateExpanded"
      class="inline-flex items-center gap-x-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold font-display shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-blue-500/25 hover:shadow-lg active:scale-95"
    >
      <PlusIcon 
        class="h-5 w-5 transition-transform duration-200" 
        :class="{ 'rotate-90': isCreateExpanded }" 
      />
      <span>New Article</span>
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-4 opacity-0"
    >
      <div v-if="isCreateExpanded" class="mt-6 p-6 rounded-lg bg-zinc-900/50 border border-zinc-800 w-full">
        <h3 class="text-lg font-semibold text-zinc-100 mb-4">Create New Article</h3>
        <form @submit.prevent="createArticle" class="space-y-4">
          <div>
            <label for="title" class="block text-sm font-medium text-zinc-400">Title</label>
            <input
              id="title"
              v-model="newArticle.title"
              type="text"
              autocomplete="off"
              class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label for="excerpt" class="block text-sm font-medium text-zinc-400">Excerpt</label>
            <input
              id="excerpt"
              v-model="newArticle.excerpt"
              type="text"
              class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label for="content" class="block text-sm font-medium text-zinc-400">Content (Markdown)</label>
            <div class="mt-1 flex flex-col gap-4">
              <!-- Markdown shortcuts -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="shortcut in markdownShortcuts"
                  :key="shortcut.label"
                  type="button"
                  @click="applyMarkdown(shortcut)"
                  class="px-2 py-1 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  {{ shortcut.label }}
                </button>
              </div>

              <div class="grid grid-cols-2 gap-4 h-[400px]">
                <!-- Editor -->
                <div class="flex flex-col">
                  <span class="text-sm text-zinc-500 mb-2">Editor</span>
                  <textarea
                    id="content"
                    v-model="newArticle.content"
                    ref="contentEditor"
                    @keydown="handleContentKeydown"
                    class="flex-1 rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 font-mono resize-none"
                    required
                  ></textarea>
                </div>
                
                <!-- Preview -->
                <div class="flex flex-col">
                  <span class="text-sm text-zinc-500 mb-2">Preview</span>
                  <div class="flex-1 p-4 rounded-md bg-zinc-900 border border-zinc-700 overflow-y-auto">
                    <div 
                      class="prose prose-invert prose-sm h-full overflow-y-auto"
                      v-html="markdownPreview"
                    />
                  </div>
                </div>
              </div>
            </div>
            <p class="mt-2 text-sm text-zinc-500">
              Use the shortcuts above or write Markdown directly. Supports **bold**, *italic*, [links](url), and more.
            </p>
          </div>

          <div>
            <label for="image" class="block text-sm font-medium text-zinc-400">Image URL (optional)</label>
            <input
              id="image"
              v-model="newArticle.image"
              type="url"
              class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-2">Tags</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <span
                v-for="tag in newArticle.tags"
                :key="tag"
                class="inline-flex items-center gap-x-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-600/80 text-white"
              >
                {{ tag }}
                <button
                  type="button"
                  @click="removeTag(tag)"
                  class="text-white hover:text-white/80"
                >
                  <XMarkIcon class="h-3 w-3" />
                </button>
              </span>
            </div>
            <div class="flex gap-x-2">
              <input
                type="text"
                v-model="newTagInput"
                @keydown.enter.prevent="addTag"
                placeholder="Add a tag..."
                class="mt-1 block w-full rounded-md bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="button"
                @click="addTag"
                class="mt-1 px-3 py-2 rounded-md bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              >
                Add
              </button>
            </div>
          </div>

          <div class="flex justify-end">
            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold font-display shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-blue-500/25 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Creating...' : 'Create Article' }}
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { micromark } from 'micromark';

const emit = defineEmits<{
  'refresh': []
}>();

const user = useUser();
const news = useNews();
const isCreateExpanded = ref(false);
const isSubmitting = ref(false);
const newTagInput = ref('');

const newArticle = ref({
  title: '',
  excerpt: '',
  content: '',
  image: '',
  tags: [] as string[]
});

const contentEditor = ref<HTMLTextAreaElement>();

const markdownShortcuts = [
  { label: 'Bold', prefix: '**', suffix: '**', placeholder: 'bold text' },
  { label: 'Italic', prefix: '_', suffix: '_', placeholder: 'italic text' },
  { label: 'Link', prefix: '[', suffix: '](url)', placeholder: 'link text' },
  { label: 'Code', prefix: '`', suffix: '`', placeholder: 'code' },
  { label: 'List Item', prefix: '- ', suffix: '', placeholder: 'list item' },
  { label: 'Heading', prefix: '## ', suffix: '', placeholder: 'heading' },
];

const handleContentKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    
    const textarea = contentEditor.value;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const text = textarea.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const currentLine = text.slice(lineStart, start);
    
    // Check if the current line starts with a list marker
    const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
    let insertion = '\n';
    
    if (listMatch) {
      // If the line is empty except for the list marker, end the list
      if (currentLine.trim() === listMatch[0].trim()) {
        const removeLength = currentLine.length;
        newArticle.value.content = 
          text.slice(0, lineStart) + 
          text.slice(lineStart + removeLength);
        
        // Move cursor to new position after removing the list marker
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = lineStart;
        });
        return;
      }
      // Otherwise, continue the list
      insertion = '\n' + listMatch[1] + listMatch[2] + ' ';
    }
    
    newArticle.value.content = 
      text.slice(0, start) + 
      insertion + 
      text.slice(start);
    
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = 
        start + insertion.length;
    });
  }
};

const addTag = () => {
  const tag = newTagInput.value.trim();
  if (tag && !newArticle.value.tags.includes(tag)) {
    newArticle.value.tags.push(tag);
    newTagInput.value = ''; // Clear the input
  }
};

const removeTag = (tagToRemove: string) => {
  newArticle.value.tags = newArticle.value.tags.filter(tag => tag !== tagToRemove);
};

const applyMarkdown = (shortcut: typeof markdownShortcuts[0]) => {
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
};

const createArticle = async () => {
  if (!user.value?.id) {
    console.error('User not authenticated');
    return;
  }

  isSubmitting.value = true;
  try {
    await news.create({
      ...newArticle.value,
      authorId: user.value.id,
    });
    
    // Reset form
    newArticle.value = {
      title: '',
      excerpt: '',
      content: '',
      image: '',
      tags: []
    };
    
    emit('refresh');
    
    isCreateExpanded.value = false;
    
  } catch (error) {
    console.error('Failed to create article:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const markdownPreview = computed(() => {
  return micromark(newArticle.value.content);
});
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
