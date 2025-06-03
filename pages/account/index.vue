<!-- eslint-disable vue/no-v-html -->
<template>
  <div>
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
        Hello, {{ user.displayName }}!
      </h2>
      <p class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8">
        Welcome to your Drop account. Here you can view and manage your account information.
      </p>
    </div>

    <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <!-- Account Information Card -->
      <div class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50">
        <div class="p-6">
          <h3 class="text-base font-semibold text-zinc-100">Account Information</h3>
          <dl class="mt-4 space-y-4">
            <div class="flex justify-between">
              <dt class="text-sm font-medium text-zinc-400">Username</dt>
              <dd class="text-sm text-zinc-100">{{ user.username }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm font-medium text-zinc-400">Email</dt>
              <dd class="text-sm text-zinc-100">{{ user.email }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm font-medium text-zinc-400">Account Type</dt>
              <dd>
                <span :class="[
                  user.admin 
                    ? 'inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20'
                    : 'inline-flex items-center rounded-md bg-zinc-400/10 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-400/20'
                ]">
                  {{ user.admin ? "Administrator" : "Standard User" }}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Account Actions Card -->
      <div class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50">
        <div class="p-6">
          <h3 class="text-base font-semibold text-zinc-100">Account Actions</h3>
          <div class="mt-4 space-y-3">
            <button
              type="button"
              class="w-full inline-flex items-center justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-[1.02] hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
            >
              Change Password
            </button>
            <button
              type="button"
              class="w-full inline-flex items-center justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-[1.02] hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
            >
              Update Email
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import type { User } from "~/prisma/client";

definePageMeta({
  layout: "default",
});

useHead({
  title: "Account",
});

// Fetch user data
const user = await $dropFetch<User>("/api/v1/user");
</script>
