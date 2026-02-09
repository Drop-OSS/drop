<template>
  <TileWithLink>
    <div class="h-full flex gap-4">
      <div class="flex-1 my-auto">
        <slot name="icon" />
      </div>
      <div
        class="md:flex-8 flex-6 lg:flex-2 my-auto text-center flex md:flex-row-reverse lg:inline"
      >
        <div class="md:text-2xl text-3xl flex-1 font-bold self-center">
          {{ value }}
        </div>
        <div
          class="text-2xl xl:text-xs flex-1 md:flex-auto text-left md:text-center lg:text-center self-center"
        >
          {{ label }}
        </div>
      </div>
    </div>
  </TileWithLink>
</template>

<script setup lang="ts">
const { label, value } = defineProps<{
  label: string;
  value: string | number;
}>();
</script>
