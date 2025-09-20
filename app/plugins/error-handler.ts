export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("vue:error", (error, instance, info) => {
    console.error(info, error, instance);
  });
});
