<template>
  <table class="w-full m-2 border-none border-collapse">
    <tbody>
      <tr
        v-for="item in items"
        :key="`${item.rank}-${item.name}`"
        class="border-solid border-b-2 last:border-none"
      >
        <td>{{ item.rank }}</td>
        <td class="font-bold">{{ item.name }}</td>
        <td>{{ item.value }}</td>
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
