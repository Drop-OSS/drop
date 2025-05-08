<template>
  <div>
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2
        class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
      >
        Authentication
      </h2>
      <p
        class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8"
      >
        Drop supports a variety of "authentication mechanisms". As you enable or
        disable them, they are shown on the sign in screen for users to select
        from. Click the dot menu to configure the authentication mechanism.
      </p>
    </div>
    <ul
      role="list"
      class="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-4 xl:gap-x-8"
    >
      <li
        v-for="authMech in authenticationMechanisms"
        :key="authMech.name"
        class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
      >
        <div class="flex items-center gap-x-4 border-b border-zinc-800 p-6">
          <component
            :is="authMech.icon"
            :alt="`${authMech.name} icon`"
            class="h-8 w-8 flex-none rounded-lg text-zinc-100 object-cover"
          />
          <div class="text-sm/6 font-medium text-zinc-100">
            {{ authMech.name }}
          </div>
          <Menu v-if="authMech.route" as="div" class="relative ml-auto">
            <MenuButton
              class="-m-2.5 block p-2.5 text-gray-400 hover:text-gray-500"
            >
              <span class="sr-only">Open options</span>
              <EllipsisHorizontalIcon class="h-5 w-5" aria-hidden="true" />
            </MenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-zinc-900 py-2 shadow-lg ring-1 ring-zinc-100/5 focus:outline-none"
              >
                <MenuItem v-slot="{ active }">
                  <NuxtLink
                    :href="authMech.route"
                    :class="[
                      active ? 'bg-zinc-800 outline-none' : '',
                      'block px-3 py-1 text-sm/6 text-zinc-100',
                    ]"
                    >Configure<span class="sr-only"
                      >, {{ authMech.name }}</span
                    ></NuxtLink
                  >
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
        <dl class="-my-3 divide-y divide-zinc-700 px-6 py-4 text-sm/6">
          <div class="flex justify-between gap-x-4 py-3">
            <dt class="text-zinc-400">Enabled</dt>
            <dd class="flex items-center">
              <CheckIcon
                v-if="authMech.enabled"
                class="w-4 h-4 text-green-600"
              />
              <XMarkIcon v-else class="w-4 h-4 text-red-600" />
            </dd>
          </div>
          <div v-if="authMech.settings">
            <div
              v-for="[key, value] in Object.entries(authMech.settings)"
              :key="key"
              class="flex flex-nowrap justify-between gap-x-4 py-2"
            >
              <dt class="text-zinc-400">{{ key }}</dt>
              <dd class="text-gray-500 truncate">
                {{ value }}
              </dd>
            </div>
          </div>
        </dl>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { IconsSimpleAuthenticationLogo, IconsSSOLogo } from "#components";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { EllipsisHorizontalIcon } from "@heroicons/vue/20/solid";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import type { AuthMec } from "@prisma/client";
import type { Component } from "vue";

useHead({
  title: "Authentication",
});

definePageMeta({
  layout: "admin",
});

const enabledMechanisms = await $dropFetch("/api/v1/admin/auth");

const authenticationMechanisms: Array<{
  name: string;
  mec: AuthMec;
  icon: Component;
  route?: string;
  enabled: boolean;
  settings?: { [key: string]: string | undefined } | undefined | boolean;
}> = [
  {
    name: "Simple (username/password)",
    mec: "Simple" as AuthMec,
    icon: IconsSimpleAuthenticationLogo,
    route: "/admin/users/auth/simple",
  },
  {
    name: "OpenID Connect",
    mec: "OpenID" as AuthMec,
    icon: IconsSSOLogo,
  },
].map((e) => ({
  ...e,
  enabled: !!enabledMechanisms[e.mec],
  settings:
    typeof enabledMechanisms[e.mec] === "object" && enabledMechanisms[e.mec],
}));
</script>
