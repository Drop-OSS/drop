export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("vue:error", (error, instance, info) => {
    console.error(error, instance, info);
  });
});
