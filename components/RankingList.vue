<template>
  <table class="w-full m-2 border-spacing-4 border-separate">
    <tbody>
      <tr v-for="item in items" :key="`${item.rank}-${item.name}`">
        <td class="italic text-right">{{ item.rank }}</td>
        <td class="font-bold">{{ item.name }}</td>
        <td class="text-right">{{ item.value }}</td>
      </tr>
    </tbody>
  </table>
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
