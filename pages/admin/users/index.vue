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
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Authentication &rarr;
        </NuxtLink>
      </div>
    </div>
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow">
            <table class="min-w-full divide-y divide-zinc-700">
              <thead>
                <tr class="bg-zinc-800/50">
                  <th
                    scope="col"
                    class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-6"
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
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-700">
                <tr v-for="user in users" :key="user.id" class="hover:bg-zinc-800/50 transition-colors duration-150">
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
                    <span :class="[
                      user.admin 
                        ? 'inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20'
                        : 'inline-flex items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20'
                    ]">
                      {{ user.admin ? "Admin User" : "Normal user" }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                    <div class="flex flex-wrap gap-1">
                      <span v-for="mec in user.authMecs" :key="mec.mec" class="inline-flex items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20">
                        {{ mec.mec }}
                      </span>
                    </div>
                  </td>
                  <td
                    class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"
                  >
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
