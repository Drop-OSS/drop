<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="w-full overflow-x-hidden">
    <div class="relative overflow-hidden bg-zinc-900">
      <!-- Decorative background image and gradient -->
      <div aria-hidden="true" class="absolute inset-0">
        <div class="absolute inset-0 overflow-hidden">
          <img
            :src="useObject(company.mBannerObjectId)"
            alt=""
            class="size-full object-cover"
          />
        </div>
        <div class="absolute inset-0 bg-zinc-900/75" />
        <div class="absolute inset-0 bg-linear-to-t from-zinc-900" />
      </div>

      <!-- Callout -->
      <section
        aria-labelledby="sale-heading"
        class="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-32 pb-8 text-center sm:px-6 lg:px-8"
      >
        <div class="mx-auto max-w-2xl lg:max-w-none">
          <h2
            id="sale-heading"
            class="text-4xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl"
          >
            {{ company.mName }}
          </h2>
          <p class="mx-auto line-clamp-3 mt-4 max-w-xl text-xl text-zinc-400">
            {{ company.mDescription }}
          </p>
        </div>
      </section>
    </div>
    <StoreView
      :extra-options="[
        {
          name: 'Company',
          param: 'companyActions',
          multiple: true,
          options: [
            { name: 'Published', param: 'published' },
            { name: 'Developed', param: 'developed' },
          ],
        },
      ]"
      :params="{
        company: company.id,
      }"
    />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const companyId = route.params.id;

const { company } = await $dropFetch(`/api/v1/companies/${companyId}`);

useHead({
  title: company.mName,
  link: [{ rel: "icon", href: useObject(company.mLogoObjectId) }],
});
</script>
