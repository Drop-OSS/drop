<template>
  <div>
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
        Devices
      </h2>
      <p class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8">
        Manage the devices authorized to access your Drop account.
      </p>
    </div>

    <div class="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-zinc-800">
          <thead>
            <tr class="bg-zinc-800/50">
              <th
                scope="col"
                class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-6"
              >
                Name
              </th>
              <th
                scope="col"
                class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
              >
                Platform
              </th>
              <th
                scope="col"
                class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
              >
                Capabilities
              </th>
              <th
                scope="col"
                class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
              >
                Last Connected
              </th>
              <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr
              v-for="client in clients"
              :key="client.id"
              class="transition-colors duration-150 hover:bg-zinc-800/50"
            >
              <td
                class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-6"
              >
                {{ client.name }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                <span class="inline-flex items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20">
                  {{ client.platform }}
                </span>
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="capability in client.capabilities"
                    :key="capability"
                    class="inline-flex items-center gap-x-1 rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20"
                  >
                    <CheckIcon class="size-3" />
                    {{ capability }}
                  </span>
                </div>
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                {{ DateTime.fromISO(client.lastConnected).toRelative() }}
              </td>
              <td
                class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"
              >
                <button
                  class="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20 transition-all duration-200 hover:bg-red-400/20 hover:scale-105 active:scale-95"
                  @click="() => revokeClientWrapper(client.id)"
                >
                  Revoke<span class="sr-only">, {{ client.name }}</span>
                </button>
              </td>
            </tr>
            <tr v-if="clients.length === 0">
              <td colspan="5" class="py-8 text-center text-sm text-zinc-400">
                No devices connected to your account.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon } from "@heroicons/vue/24/outline";
import { DateTime } from "luxon";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore pending https://github.com/nitrojs/nitro/issues/2758
const clients = ref(await $dropFetch("/api/v1/user/client"));

async function revokeClient(id: string) {
  await $dropFetch(`/api/v1/user/client/${id}`, { method: "DELETE" });
}

function revokeClientWrapper(id: string) {
  revokeClient(id)
    .then(() => {
      const index = clients.value.findIndex((e) => e.id == id);
      clients.value.splice(index, 1);
    })
    .catch((e) => {
      createModal(
        ModalType.Notification,
        {
          title: "Failed to revoke client",
          description: `Failed to revoke client: ${e}`,
        },
        (_, c) => c(),
      );
    });
}
</script>
