// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: false },

  css: ["~/assets/core.scss"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  app: {
    head: {
      link: [{ rel: "icon", href: "/favicon.ico" }],
    },
  },

  nitro: {
    experimental: {
      websocket: true,
    },
  },
});
