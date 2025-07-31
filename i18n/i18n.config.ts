export default defineI18nConfig(() => {
  const defaultDateTimeFormat = {
    short: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    long: {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
    },
  } as const;

  return {
    // https://i18n.nuxtjs.org/docs/guide/locale-fallback
    fallbackLocale: "en-us",
    // https://vue-i18n.intlify.dev/guide/essentials/datetime.html
    datetimeFormats: {
      "en-us": defaultDateTimeFormat,
      "en-gb": defaultDateTimeFormat,
      "en-au": defaultDateTimeFormat,
      "en-pirate": defaultDateTimeFormat,
      fr: defaultDateTimeFormat,
      de: defaultDateTimeFormat,
      it: defaultDateTimeFormat,
      es: defaultDateTimeFormat,
      zh: defaultDateTimeFormat,
      "zh-tw": defaultDateTimeFormat,
    },
  };
});
