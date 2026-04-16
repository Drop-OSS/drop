// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeRapide from "starlight-theme-rapide";
import starlightLinksValidator from "starlight-links-validator";
import starlightImageZoom from "starlight-image-zoom";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      plugins: [
        starlightThemeRapide(),
        starlightLinksValidator(),
        starlightImageZoom(),
      ],
      title: "Drop OSS",
      logo: { src: "./src/assets/wordmark.png", replacesTitle: true },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Drop-OSS/",
        },
        {
          icon: "discord",
          label: "Discord",
          href: "https://discord.gg/NHx46XKJWA",
        },
        {
          icon: "matrix",
          label: "Matrix",
          href: "https://matrix.to/#/%23drop-oss:matrix.org",
        },
      ],
      sidebar: [
        {
          label: "Users",
          items: [
            { slug: "user" },
            {
              label: "Install",
              autogenerate: { directory: "user/install" },
            },
            {
              label: "Usage",
              items: [{ slug: "user/usage/proton" }],
            },
          ],
        },
        {
          label: "Admin",
          items: [
            { slug: "admin/quickstart" },
            { slug: "admin/guides/migrating" },
            {
              label: "Guides",
              items: [
                { slug: "admin/guides/exposing" },
                { slug: "admin/guides/creating-library" },
                { slug: "admin/guides/import-game" },
                { slug: "admin/guides/import-version" },
              ],
            },
            {
              label: "Going further",
              autogenerate: { directory: "admin/going-further" },
            },
            {
              label: "Metadata",
              autogenerate: { directory: "admin/metadata" },
            },
            {
              label: "Authentication",
              autogenerate: { directory: "admin/authentication" },
            },
          ],
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
      ],
      customCss: ["./src/styles/drop.css"],
    }),
  ],
  site: "https://docs-next.droposs.org/",
});
