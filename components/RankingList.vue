<template>
  <table v-if="items.length > 0" class="w-full mt-4 space-y-6">
    <thead>
      <tr>
        <th></th>
        <th></th>
        <th></th>
      </tr>
    </thead>
    <tbody class="divide-y divide-white/10">
      <tr v-for="item in items" :key="`${item.rank}-${item.name}`">
        <td
          class="my-2 size-7 rounded-sm bg-zinc-950 ring ring-zinc-800 inline-flex items-center justify-center font-bold font-display text-blue-500"
        >
          {{ item.rank }}
        </td>
        <td class="w-full font-bold px-2">{{ item.name }}</td>
        <td
          class="text-right text-sm font-semibold text-zinc-500 whitespace-nowrap"
        >
          {{ item.value }}
        </td>
      </tr>
    </tbody>
  </table>
  <p
    v-else
    class="w-full p-2 text-center uppercase text-sm font-display font-bold text-zinc-700"
  >
    {{ $t("common.noData") }}
  </p>
</template>

<script lang="ts" setup>
export type RankItem = {
  rank: number;
  name: string;
  value: string;
};
const { items } = defineProps<{
  items: RankItem[];
}>();
</script>
