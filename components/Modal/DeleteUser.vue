<template>
  <ModalTemplate :model-value="!!user">
    <template #default>
      <div>
        <DialogTitle
          as="h3"
          class="text-lg font-bold font-display text-zinc-100"
        >
          {{ $t("users.admin.deleteUser", [user?.username]) }}
        </DialogTitle>
        <p class="mt-1 text-sm text-zinc-400">
          {{ $t("common.deleteConfirm", [user?.username]) }}
        </p>
        <p class="mt-2 text-sm font-bold text-red-500">
          {{ $t("common.cannotUndo") }}
        </p>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        :loading="deleteLoading"
        class="bg-red-600 text-white hover:bg-red-500"
        @click="() => deleteUser()"
      >
        {{ $t("delete") }}
      </LoadingButton>
      <button
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
        @click="() => (user = undefined)"
      >
        {{ $t("cancel") }}
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { DialogTitle } from "@headlessui/vue";
import type { UserModel } from "~/prisma/client/models";

const user = defineModel<UserModel | undefined>();
const deleteLoading = ref(false);
const router = useRouter();
const { t } = useI18n();

async function deleteUser() {
  try {
    if (!user.value) return;

    deleteLoading.value = true;
    await $dropFetch(`/api/v1/admin/users/${user.value.id}`, {
      method: "DELETE",
    });

    user.value = undefined;

    await fetchUsers();
    router.push("/admin/users");
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.admin.user.delete.title"),
        description: t("errors.admin.user.delete.desc", [
          // @ts-expect-error attempt to display statusMessage on error
          e?.statusMessage ?? t("errors.unknown"),
        ]),
      },
      (_, c) => c(),
    );
  } finally {
    deleteLoading.value = false;
  }
}
</script>
