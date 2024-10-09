<template>
    <form @submit.prevent="register">
        <input type="text" v-model="username" placeholder="username" />
        <input type="password" v-model="password" placeholder="password" />

        <button type="submit">Submit</button>
    </form>
</template>

<script setup lang="ts">
const username = ref("");
const password = ref("");

async function register() {
    await $fetch('/api/v1/auth/signup/simple', {
        method: "POST",
        body: {
            username: username.value,
            password: password.value
        }
    })
}
</script>