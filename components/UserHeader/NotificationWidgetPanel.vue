<template>
  <PanelWidget class="flex-col gap-y-2">
    <div class="border-b border-zinc-700 pb-3 p-2">
      <div
        class="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap"
      >
        <div class="ml-4 mt-2">
          <h3 class="text-base font-semibold text-zinc-100 text-sm">
            Unread notifications
          </h3>
        </div>
        <div class="ml-4 mt-2 shrink-0">
          <NuxtLink
            to="/account/notifications"
            type="button"
            class="text-sm text-zinc-400"
          >
            View all &rarr;
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-y-2 max-h-[300px] overflow-y-scroll">
      <NotificationItem
        v-for="notification in props.notifications"
        :key="notification.id"
        :notification="notification"
      />
    </div>
    <div
      v-if="props.notifications.length == 0"
      class="text-sm text-zinc-400 p-3 text-center w-full"
    >
      No notifications
    </div>
  </PanelWidget>
</template>

<script setup lang="ts">
import type { Notification } from "@prisma/client";

const props = defineProps<{ notifications: Array<Notification> }>();
</script>
