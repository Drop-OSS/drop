<template>
  <TransitionGroup name="modal">
    <component
      v-for="(modal, modalIdx) in stack"
      :key="modal.data"
      :is="modal.component"
      :z-height="(modalIdx + 1) * 50"
      :loading="modal.loading"
      :data="modal.data"
      @event="
        (event: string, ...args: any[]) => handleCallback(modalIdx, event, args)
      "
    />
  </TransitionGroup>
  <div id="modalstack"></div>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-to {
  opacity: 100;
}
.modal-leave-from {
  opacity: 100;
}
.modal-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
const stack = useModalStack();

async function handleCallback(modalIdx: number, event: string, args: any[]) {
  const modal = stack.value[modalIdx];
  const close = () => {
    stack.value.splice(modalIdx, 1);
  };

  // Gets unwrapped when we call from the DOM
  // I kinda hate this but it's how Vue works so....
  (modal.loading as unknown as boolean) = true;
  try {
    await modal.callback(event, close, ...args);
  } finally {
    (modal.loading as unknown as boolean) = false;
  }
}
</script>
