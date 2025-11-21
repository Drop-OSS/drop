// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import vueI18n from "@intlify/eslint-plugin-vue-i18n";
import noPrismaDelete from "./rules/no-prisma-delete.mts";

export default withNuxt([
  eslintConfigPrettier,

  // vue-i18n plugin
  ...vueI18n.configs.recommended,
  {
    rules: {
      // Optional.
      "@intlify/vue-i18n/no-dynamic-keys": "error",
      "@intlify/vue-i18n/no-unused-keys": [
        "off",
        {
          extensions: [".js", ".vue", ".ts"],
        },
      ],
      "@intlify/vue-i18n/no-missing-keys": "error",
      "drop/no-prisma-delete": "error",
    },
    settings: {
      "vue-i18n": {
        localeDir: "./i18n/locales/*.{json,json5,ts,js}", // extension is glob formatting!

        // Specify the version of `vue-i18n` you are using.
        // If not specified, the message will be parsed twice.
        messageSyntaxVersion: "^11.0.0",
      },
    },
    plugins: {
      drop: { rules: { "no-prisma-delete": noPrismaDelete } },
    },
  },
]);
