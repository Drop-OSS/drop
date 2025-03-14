<template>
  <div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">Users</h1>
        <p class="mt-2 text-sm text-zinc-400">
          Manage the users on your Drop instance, and configure your
          authentication methods.
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <NuxtLink
          to="/admin/users/auth"
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Authentication &rarr;
        </NuxtLink>
      </div>
    </div>
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table class="min-w-full divide-y divide-zinc-700">
            <thead>
              <tr>
                <th
                  scope="col"
                  class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-3"
                >
                  Display Name
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Username
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Email
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Admin?
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Auth Options
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-3">
                  <span class="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id" class="even:bg-zinc-800">
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
                >
                  {{ user.displayName }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ user.username }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ user.email }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ user.admin ? "Admin User" : "Normal user" }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ user.authMecs.map((e) => e.mec).join(", ") }}
                </td>
                <td
                  class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-3"
                >
                  <!--
                  <a href="#" class="text-blue-600 hover:text-blue-500"
                    >Edit<span class="sr-only"
                      >, {{ user.displayName }}</span
                    ></a
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
</template>

<script setup lang="ts">
useHead({
  title: "Users",
});

definePageMeta({
  layout: "admin",
});

const users = await $dropFetch("/api/v1/admin/users");
</script>
