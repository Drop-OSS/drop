<template>
  <div>
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
        Notifications
      </h2>
      <p class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8">
        View and manage your notifications.
      </p>
    </div>

    <div class="mt-8 flex justify-end">
      <button
        v-if="notifications.length > 0"
        type="button"
        class="inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
        @click="markAllAsRead"
      >
        <CheckIcon class="size-4" />
        Mark all as read
      </button>
    </div>

    <div class="mt-4 space-y-4">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50"
        :class="{ 'opacity-75': notification.read }"
      >
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-base font-semibold text-zinc-100">
                {{ notification.title }}
              </h3>
              <p class="mt-1 text-sm text-zinc-400">
                {{ notification.description }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <a
                  v-for="action in notification.actions"
                  :key="action"
                  :href="action.split('|')[1]"
                  class="inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20 transition-all duration-200 hover:bg-blue-400/20 hover:scale-105 active:scale-95"
                >
                  {{ action.split('|')[0] }}
                </a>
              </div>
            </div>
            <div class="ml-4 flex flex-shrink-0 items-center gap-x-2">
              <span class="text-xs text-zinc-500">
                {{ DateTime.fromISO(notification.created).toRelative() }}
              </span>
              <button
                v-if="!notification.read"
                type="button"
                class="inline-flex items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20 transition-all duration-200 hover:bg-zinc-400/20 hover:scale-105 active:scale-95"
                @click="markAsRead(notification.id)"
              >
                <CheckIcon class="size-3" />
                Mark as read
              </button>
              <button
                type="button"
                class="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20 transition-all duration-200 hover:bg-red-400/20 hover:scale-105 active:scale-95"
                @click="deleteNotification(notification.id)"
              >
                <TrashIcon class="size-3" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="notifications.length === 0"
        class="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center"
      >
        <p class="text-sm text-zinc-400">No notifications</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon, TrashIcon } from "@heroicons/vue/24/outline";
import { DateTime } from "luxon";
import type { Notification } from "~/prisma/client";

definePageMeta({
  layout: "default",
});

useHead({
  title: "Notifications",
});

// Fetch notifications
const notifications = ref<Notification[]>([]);

async function fetchNotifications() {
  notifications.value = await $dropFetch<Notification[]>("/api/v1/notifications");
}

// Initial fetch
await fetchNotifications();

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
  await $dropFetch("/api/v1/notifications/readall", { method: "POST" });
  notifications.value.forEach((notification) => {
    notification.read = true;
  });
}

// Delete a notification
async function deleteNotification(id: string) {
  await $dropFetch(`/api/v1/notifications/${id}`, { method: "DELETE" });
  const index = notifications.value.findIndex((n) => n.id === id);
  if (index !== -1) {
    notifications.value.splice(index, 1);
  }
}
</script>
