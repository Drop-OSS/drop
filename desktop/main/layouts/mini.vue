<template>
  <div class="flex flex-col bg-surface-950 overflow-hidden h-screen">
    <MiniHeader />
    <div class="relative grow overflow-y-auto">
      <slot />
    </div>
  </div>
</template>
