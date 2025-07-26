<template>
  <div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">
          {{ $t("header.admin.users") }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ $t("users.admin.description") }}
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <NuxtLink
          to="/admin/users/auth"
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <i18n-t keypath="users.admin.authLink" tag="span" scope="global">
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
      </div>
    </div>
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div
            class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow"
          >
            <table class="min-w-full divide-y divide-zinc-700">
              <thead>
                <tr class="bg-zinc-800/50">
                  <th
                    scope="col"
                    class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-6"
                  >
                    {{ $t("users.admin.displayNameHeader") }}
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                  >
                    {{ $t("users.admin.usernameHeader") }}
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                  >
                    {{ $t("users.admin.emailHeader") }}
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                  >
                    {{ $t("users.admin.adminHeader") }}
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                  >
                    {{ $t("users.admin.authoptionsHeader") }}
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">
                      {{ $t("users.admin.srEditLabel") }}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-700">
                <tr
                  v-for="user in users"
                  :key="user.id"
                  class="hover:bg-zinc-800/50 transition-colors duration-150"
                >
                  <td
                    class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-6"
                  >
                    {{ user.displayName }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                    {{ user.username }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                    {{ user.email }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm">
                    <span
                      :class="[
                        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
                        user.admin
                          ? 'bg-blue-400/10 text-blue-400 ring-blue-400/20'
                          : 'bg-zinc-400/10 text-zinc-400 ring-zinc-400/20',
                      ]"
                    >
                      {{
                        user.admin
                          ? $t("users.admin.adminUserLabel")
                          : $t("users.admin.normalUserLabel")
                      }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="mec in user.authMecs"
                        :key="mec.mec"
                        class="inline-flex items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20"
                      >
                        {{ mec.mec }}
                      </span>
                    </div>
                  </td>
                  <td
                    class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"
                  >
                    <button
                      v-if="user.id !== currentUser?.id"
                      class="px-2 py-1 rounded bg-red-900/50 backdrop-blur-sm transition text-sm/6 font-semibold text-red-400 hover:text-red-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
                      @click="() => setUserToDelete(user)"
                    >
                      {{ $t("users.admin.delete") }}
                    </button>

                    <!--
                    <NuxtLink to="#" class="text-blue-600 hover:text-blue-500"
                      >Edit<span class="sr-only"
                        >, {{ user.displayName }}</span
                      ></NuxtLink
                    >
                    -->
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <ModalDeleteUser v-model="userToDelete" />
  </div>
</template>

<script setup lang="ts">
import { useUsers } from "~/composables/users";
import type { UserModel } from "~/prisma/client/models";

useHead({
  title: "Users",
});

definePageMeta({
  layout: "admin",
});

const users = useUsers();
const currentUser = useUser();

if (!users.value) {
  await fetchUsers();
}

const userToDelete = ref();

const setUserToDelete = (user: UserModel) => (userToDelete.value = user);
</script>
