<template>
  <div class="pointer-events-auto w-full bg-zinc-950/40 rounded">
    <div class="p-4">
      <div class="flex items-start">
        <div class="w-0 flex-1 pt-0.5">
          <p class="text-sm font-medium text-zinc-100">
            {{ notification.title }}
          </p>
          <p class="mt-1 text-sm text-zinc-400 line-clamp-3">
            {{ notification.description }}
          </p>
          <div
            v-if="notification.actions.length > 0"
            class="mt-3 flex space-x-7"
          >
            <NuxtLink
              v-for="[name, link] in notification.actions.map((e) =>
                e.split('|')
              )"
              :key="name"
              type="button"
              :href="link"
              class="rounded-md text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {{ name }}
            </NuxtLink>
            <!-- todo -->
          </div>
        </div>
        <div class="ml-4 flex shrink-0">
          <button
            @click="() => deleteMe()"
            type="button"
            class="inline-flex rounded-md text-zinc-400 hover:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span class="sr-only">Close</span>
            <XMarkIcon class="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/solid";
import type { Notification } from "@prisma/client";

const props = defineProps<{ notification: Notification }>();

async function deleteMe() {
  await $dropFetch(`/api/v1/notifications/${props.notification.id}`, {
    method: "DELETE",
  });
  const notifications = useNotifications();
  const indexOfMe = notifications.value.findIndex(
    (e) => e.id === props.notification.id
  );
  // Delete me
  notifications.value.splice(indexOfMe, 1);
}
</script>
