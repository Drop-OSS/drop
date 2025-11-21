<template>
  <div>
    <div class="border-b border-zinc-800 pb-4 w-full">
      <div
        class="gap-2 flex flex-col lg:flex-row lg:items-center justify-between w-full"
      >
        <h2
          class="text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
        >
          {{ $t("account.notifications.notifications") }}
        </h2>
        <div class="inline-flex gap-x-2">
          <button
            :disabled="notifications.length === 0"
            class="inline-flex items-center justify-center gap-x-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-[1.02] hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:scale-100 disabled:hover:shadow-none"
            @click="markAllAsRead"
          >
            <CheckIcon class="size-4" />
            {{ $t("account.notifications.markAllAsRead") }}
          </button>
          <button
            :disabled="notifications.length === 0"
            class="inline-flex items-center justify-center gap-x-2 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-red-100 shadow-sm transition-all duration-200 hover:bg-red-700 hover:scale-[1.02] hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-800 disabled:hover:scale-100 disabled:hover:shadow-none"
            @click="clearNotifications"
          >
            <TrashIcon class="size-4" />
            {{ $t("account.notifications.clear") }}
          </button>
        </div>
      </div>
      <p
        class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8"
      >
        {{ $t("account.notifications.desc") }}
      </p>
    </div>

    <div class="mt-4 space-y-4">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50"
        :class="{ 'opacity-75': notification.read }"
      >
        <div class="p-6">
          <div class="flex flex-col lg:flex-row items-start justify-between">
            <div class="flex-1">
              <h3 class="text-base font-semibold text-zinc-100">
                {{ notification.title }}
              </h3>
              <p class="mt-1 text-sm text-zinc-400">
                {{ notification.description }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <NuxtLink
                  v-for="[name, href] in notification.actions.map((v) =>
                    v.split('|'),
                  )"
                  :key="href"
                  :href="href"
                  class="inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20 transition-all duration-200 hover:bg-blue-400/20 hover:scale-105 active:scale-95"
                >
                  {{ name }}
                </NuxtLink>
              </div>
            </div>
            <div
              class="mt-4 lg:mt-0 lg:ml-4 flex flex-shrink-0 items-center gap-x-2"
            >
              <span class="text-xs text-zinc-500">
                <RelativeTime :date="notification.created" />
              </span>
              <button
                v-if="!notification.read"
                type="button"
                class="inline-flex gap-x-1 items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20 transition-all duration-200 hover:bg-zinc-400/20 hover:scale-105 active:scale-95"
                @click="markAsRead(notification.id)"
              >
                <CheckIcon class="size-3" />
                {{ $t("account.notifications.markAsRead") }}
              </button>
              <button
                type="button"
                class="inline-flex gap-x-1 items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20 transition-all duration-200 hover:bg-red-400/20 hover:scale-105 active:scale-95"
                @click="deleteNotification(notification.id)"
              >
                <TrashIcon class="size-3" />
                {{ $t("delete") }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="notifications.length === 0"
        class="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center"
      >
        <p class="text-sm text-zinc-400">
          {{ $t("account.notifications.none") }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon, TrashIcon } from "@heroicons/vue/24/outline";
import type { NotificationModel } from "~/prisma/client/models";
import type { SerializeObject } from "nitropack";

definePageMeta({
  layout: "default",
});

const { t } = useI18n();

useHead({
  title: t("account.notifications.title"),
});

// Fetch notifications
const notifications = useNotifications();

// Mark a notification as read
async function markAsRead(id: string) {
  await $dropFetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
  const notification = notifications.value.find((n) => n.id === id);
  if (notification) {
    notification.read = true;
  }
}

// Mark all notifications as read
async function markAllAsRead() {
  await $dropFetch("/api/v1/notifications/readall", {
    method: "POST",
    failTitle: "Failed to read all notifications",
  });
  notifications.value.forEach((notification) => {
    notification.read = true;
  });
}

async function clearNotifications() {
  await $dropFetch("/api/v1/notifications/clear", {
    method: "POST",
    failTitle: "Failed to clear notifications",
  });
  notifications.value = [];
}

// Delete a notification
async function deleteNotification(id: string) {
  await $dropFetch(`/api/v1/notifications/${id}`, { method: "DELETE" });
  const index = notifications.value.findIndex(
    (n: SerializeObject<NotificationModel>) => n.id === id,
  );
  if (index !== -1) {
    notifications.value.splice(index, 1);
  }
}
</script>
