<template>
  <ModalTemplate :model-value="!!article">
    <template #default>
      <div>
        <DialogTitle
          as="h3"
          class="text-lg font-bold font-display text-zinc-100"
        >
          Delete Article
        </DialogTitle>
        <p class="mt-1 text-sm text-zinc-400">
          Are you sure you want to delete "{{ article?.title }}"?
        </p>
        <p class="mt-2 text-sm font-bold text-red-500">
          This action cannot be undone.
        </p>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        :loading="deleteLoading"
        class="bg-red-600 text-white hover:bg-red-500"
        @click="() => deleteArticle()"
      >
        Delete
      </LoadingButton>
      <button
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
        @click="() => (article = undefined)"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { DialogTitle } from "@headlessui/vue";

interface Article {
  id: string;
  title: string;
}

const article = defineModel<Article | undefined>();
const deleteLoading = ref(false);
const router = useRouter();
const news = useNews();
if (!news.value) {
  news.value = await fetchNews();
}

async function deleteArticle() {
  try {
    if (!article.value || !news.value) return;

    deleteLoading.value = true;
    await $dropFetch(`/api/v1/admin/news/${article.value.id}`, {
      method: "DELETE",
    });

    const index = news.value.findIndex((e) => e.id == article.value?.id);
    news.value.splice(index, 1);

    article.value = undefined;
    router.push("/news");
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to delete article",
        // @ts-expect-error attempt to display statusMessage on error
        description: `Drop couldn't delete this article: ${e?.statusMessage}`,
      },
      (_, c) => c(),
    );
  } finally {
    deleteLoading.value = false;
  }
}
</script>
