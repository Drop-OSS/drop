<template>
  <div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">Devices</h1>
        <p class="mt-2 text-sm text-zinc-400">
          All the devices authorized to access your Drop account.
        </p>
      </div>
    </div>
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table class="min-w-full divide-y divide-zinc-800">
            <thead>
              <tr>
                <th
                  scope="col"
                  class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-3"
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
                  Can Access
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Last Connected
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-3">
                  <span class="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="client in clients"
                :key="client.id"
                class="even:bg-zinc-800"
              >
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
                >
                  {{ client.name }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ client.platform }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  <ul class="flex flex-col gap-y-2">
                    <li
                      class="inline-flex items-center gap-x-0.5"
                      v-for="capability in client.capabilities"
                    >
                      <CheckIcon class="size-4" /> {{ capability }}
                    </li>
                  </ul>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ moment(client.lastConnected).fromNow() }}
                </td>
                <td
                  class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-3"
                >
                  <button
                    @click="() => revokeClientWrapper(client.id)"
                    class="text-red-600 hover:text-red-900"
                  >
                    Revoke<span class="sr-only">, {{ client.name }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon } from "@heroicons/vue/24/outline";
import moment from "moment";

const clients = await $dropFetch("/api/v1/user/client");

async function revokeClient(id: string) {
  await $dropFetch(`/api/v1/user/client/${id}`, { method: "DELETE" });
}

function revokeClientWrapper(id: string) {
  revokeClient(id)
    .then(() => {
      const index = clients.findIndex((e) => e.id == id);
      clients.splice(index, 1);
    })
    .catch((e) => {
      createModal(
        ModalType.Notification,
        {
          title: "Failed to revoke client",
          description: `Failed to revoke client: ${e}`,
        },
        (_, c) => c()
      );
    });
}
</script>
