<template>
  <input
    v-for="i in length"
    ref="codeElements"
    :key="i"
    v-model="code[i - 1]"
    :class="[
      size,
      'uppercase appearance-none text-center bg-zinc-900 rounded-xl border-zinc-700 focus:border-blue-600 text-bold font-display text-zinc-100',
    ]"
    type="text"
    pattern="\d*"
    :placeholder="placeholder[i - 1]"
    @keydown="(v) => keydown(i - 1, v)"
    @input="() => input(i - 1)"
    @focusin="() => select(i - 1)"
    @paste="(v) => paste(i - 1, v)"
  />
</template>

<script setup lang="ts">
const {
  length = 7,
  placeholder = "1A2B3C4",
  size = "w-16 h-16 text-2xl",
} = defineProps<{
  length?: number;
  placeholder?: string;
  size?: string;
}>();
const emit = defineEmits<{
  (e: "complete", code: string): void;
}>();

const codeElements = useTemplateRef("codeElements");
const code = ref<string[]>([]);

function keydown(index: number, event: KeyboardEvent) {
  if (event.key === "Backspace" && !code.value[index] && index > 0) {
    codeElements.value![index - 1].focus();
  }
}

function input(index: number) {
  if (codeElements.value === null) return;
  const v = code.value[index] ?? "";
  if (v.length > 1) code.value[index] = v[0];

  if (!(index + 1 >= codeElements.value.length) && v) {
    codeElements.value[index + 1].focus();
  }

  if (!(index - 1 < 0) && !v) {
    codeElements.value[index - 1].focus();
  }

  if (index == length - 1) {
    const assembledCode = code.value.join("");
    if (assembledCode.length == length) {
      complete(assembledCode);
    }
  }
}

function select(index: number) {
  if (!codeElements.value) return;
  if (index >= codeElements.value.length) return;
  codeElements.value[index].select();
}

function paste(index: number, event: ClipboardEvent) {
  const newCode = event.clipboardData!.getData("text/plain");
  for (let i = 0; i < newCode.length && i < length; i++) {
    code.value[i] = newCode[i];
    codeElements.value![i].focus();
    if (i + 1 == length) {
      complete(code.value.join(""));
    }
  }
  event.preventDefault();
}

async function complete(completedCode: string) {
  emit("complete", completedCode);
}
</script>
