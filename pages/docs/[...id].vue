<template>
  <div class="py-10 px-8 w-full">
    <ContentDoc>
      <template #not-found>
        <main
          class="mx-auto w-full max-w-7xl px-6 pb-16 pt-10 sm:pb-24 lg:px-8"
        >
          <img
            class="mx-auto h-10 w-auto sm:h-12"
            src="https://tailwindui.com/plus/img/logos/mark.svg?color=indigo&shade=600"
            alt="Your Company"
          />
          <div class="mx-auto mt-20 max-w-2xl text-center sm:mt-24">
            <p class="text-base font-semibold leading-8 text-indigo-600">404</p>
            <h1
              class="mt-4 text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl"
            >
              This page does not exist
            </h1>
            <p
              class="mt-6 text-pretty text-lg font-medium text-gray-500 sm:text-xl/8"
            >
              Sorry, we couldn’t find the page you’re looking for.
            </p>
          </div>
          <div class="mx-auto mt-16 flow-root max-w-lg sm:mt-20">
            <h2 class="sr-only">Popular pages</h2>
            <ul
              role="list"
              class="-mt-6 divide-y divide-gray-900/5 border-b border-gray-900/5"
            >
              <li
                v-for="(link, linkIdx) in links"
                :key="linkIdx"
                class="relative flex gap-x-6 py-6"
              >
                <div
                  class="flex h-10 w-10 flex-none items-center justify-center rounded-lg shadow-sm ring-1 ring-gray-900/10"
                >
                  <component
                    :is="link.icon"
                    class="h-6 w-6 text-indigo-600"
                    aria-hidden="true"
                  />
                </div>
                <div class="flex-auto">
                  <h3 class="text-sm font-semibold leading-6 text-gray-900">
                    <a :href="link.href">
                      <span class="absolute inset-0" aria-hidden="true" />
                      {{ link.name }}
                    </a>
                  </h3>
                  <p class="mt-2 text-sm leading-6 text-gray-600">
                    {{ link.description }}
                  </p>
                </div>
                <div class="flex-none self-center">
                  <ChevronRightIcon
                    class="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
              </li>
            </ul>
            <div class="mt-10 flex justify-center">
              <a
                href="#"
                class="text-sm font-semibold leading-6 text-indigo-600"
              >
                <span aria-hidden="true">&larr;</span>
                Back to home
              </a>
            </div>
          </div>
        </main>
      </template>

      <template v-slot="{ doc }">
        <article class="prose prose-invert prose-blue">
          <ContentRenderer :value="doc" />
        </article>
      </template>
    </ContentDoc>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "docs",
});
</script>
