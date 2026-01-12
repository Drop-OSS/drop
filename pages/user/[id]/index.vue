<template>
  <div class="max-w-6xl mx-auto px-4 py-10">
    <div class="flex items-center gap-x-6">
      <img
        v-if="profile?.profilePictureObjectId"
        :src="useObject(profile.profilePictureObjectId)"
        class="w-24 h-24 rounded-md object-cover"
      />
      <div>
        <h1 class="text-2xl font-bold font-display text-zinc-100">
          {{ profile?.displayName ?? profile?.username ?? $t("user.unknown") }}
        </h1>
        <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
        <div class="text-zinc-400 mt-1">@{{ profile?.username }}</div>
        <div class="mt-3">
          <NuxtLink
            v-if="isCurrentUser"
            to="/account"
            class="px-3 py-2 bg-zinc-800 rounded text-sm text-zinc-200 hover:bg-zinc-700"
          >
            {{ $t("user.editProfile") }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="mt-10">
      <h2 class="text-xl font-semibold font-display text-zinc-100">
        {{ $t("user.recent") }}
      </h2>
      <p class="mt-2 text-zinc-400">{{ $t("user.recentSub") }}</p>

      <div class="mt-6">
        <div v-if="loading" class="text-zinc-500">
          {{ $t("common.srLoading") }}
        </div>
        <div v-else-if="!profile">
          <div class="text-zinc-400">{{ $t("user.notFound") }}</div>
        </div>
        <div v-else>
          <div class="mt-4 text-zinc-400">{{ $t("user.noActivity") }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useObject } from "~/composables/objects";
import { useUser } from "~/composables/user";
import type { UserModel } from "~/prisma/client/models";

const route = useRoute();
const id = (route.params.id ?? "") as string;

const loading = ref(true);
let profile: UserModel | null = null;

try {
  profile = await $dropFetch(`/api/v1/user/${id}`);
} catch {
  profile = null;
} finally {
  loading.value = false;
}

const current = useUser();
const isCurrentUser = computed(
  () => !!current.value && current.value.id === profile?.id,
);

useHead({
  title: profile?.displayName ?? profile?.username ?? "User",
});
</script>
