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

    <!-- Users Table -->
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <ModalDeleteUser v-model="userToDelete" />

    <!-- Groups Section -->
    <div class="mt-12">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h2 class="text-base font-semibold text-zinc-100">
            {{ $t("users.admin.groups.title") }}
          </h2>
          <p class="mt-2 text-sm text-zinc-400">
            {{ $t("users.admin.groups.description") }}
          </p>
        </div>
        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="showCreateGroup = true"
          >
            {{ $t("users.admin.groups.createGroup") }}
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div
            class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
          >
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
                      {{ $t("users.admin.groups.name") }}
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                    >
                      {{ $t("users.admin.groups.descriptionField") }}
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                    >
                      {{ $t("users.admin.groups.members") }}
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                    >
                      {{ $t("users.admin.groups.bannedRatings") }}
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
                    v-for="group in groups"
                    :key="group.id"
                    class="hover:bg-zinc-800/50 transition-colors duration-150"
                  >
                    <td
                      class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-6"
                    >
                      {{ group.name }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400"
                    >
                      {{ group.description || "-" }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400"
                    >
                      {{ group._count.users }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400"
                    >
                      {{ group._count.bannedAgeRatings }}
                    </td>
                    <td
                      class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2"
                    >
                      <NuxtLink
                        :to="`/admin/users/groups/${group.id}`"
                        class="text-blue-400 hover:text-blue-300"
                      >
                        {{ $t("common.edit") }}
                      </NuxtLink>
                      <button
                        class="text-red-400 hover:text-red-300"
                        @click="groupToDelete = group"
                      >
                        {{ $t("users.admin.groups.deleteGroup") }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Group Modal -->
    <div
      v-if="showCreateGroup"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70"
      @click.self="showCreateGroup = false"
    >
      <div
        class="rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl w-full max-w-md"
      >
        <h2 class="text-lg font-semibold text-zinc-100 mb-4">
          {{ $t("users.admin.groups.createGroup") }}
        </h2>
        <div class="space-y-4">
          <div>
            <label class="text-sm/6 font-medium text-zinc-100">
              {{ $t("users.admin.groups.name") }}
            </label>
            <input
              v-model="newGroupName"
              type="text"
              class="mt-1 block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
            />
          </div>
          <div>
            <label class="text-sm/6 font-medium text-zinc-100">
              {{ $t("users.admin.groups.descriptionField") }}
            </label>
            <input
              v-model="newGroupDescription"
              type="text"
              class="mt-1 block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button
              class="rounded-md px-3 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-300"
              @click="showCreateGroup = false"
            >
              {{ $t("cancel") }}
            </button>
            <button
              class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              :disabled="newGroupName.length < 2"
              @click="createGroup"
            >
              {{ $t("users.admin.groups.createGroup") }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Group Confirm Modal -->
    <div
      v-if="groupToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70"
      @click.self="groupToDelete = undefined"
    >
      <div
        class="rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl w-full max-w-md"
      >
        <h2 class="text-lg font-semibold text-zinc-100 mb-4">
          {{ $t("users.admin.groups.deleteGroup") }}
        </h2>
        <p class="text-sm text-zinc-400 mb-4">
          {{ $t("users.admin.groups.deleteConfirm") }}
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="rounded-md px-3 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-300"
            @click="groupToDelete = undefined"
          >
            {{ $t("cancel") }}
          </button>
          <button
            class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
            @click="deleteGroup"
          >
            {{ $t("users.admin.groups.deleteGroup") }}
          </button>
        </div>
      </div>
    </div>
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

// Groups
interface GroupListItem {
  id: string;
  name: string;
  description: string;
  _count: { users: number; bannedAgeRatings: number };
}

const groups = ref<GroupListItem[]>([]);
const showCreateGroup = ref(false);
const newGroupName = ref("");
const newGroupDescription = ref("");
const groupToDelete = ref<GroupListItem | undefined>();

const fetchGroups = async () => {
  groups.value = await $dropFetch<GroupListItem[]>("/api/v1/admin/groups");
};

await fetchGroups();

const createGroup = async () => {
  await $dropFetch("/api/v1/admin/groups", {
    method: "POST",
    body: { name: newGroupName.value, description: newGroupDescription.value },
  });
  showCreateGroup.value = false;
  newGroupName.value = "";
  newGroupDescription.value = "";
  await fetchGroups();
};

const deleteGroup = async () => {
  if (!groupToDelete.value) return;
  await $dropFetch(`/api/v1/admin/groups/${groupToDelete.value.id}`, {
    method: "DELETE",
  });
  groupToDelete.value = undefined;
  await fetchGroups();
};
</script>
