/**
 * Keyless product information for GOG acquisitions. The depot pipeline used
 * to create `Manual`/`gog-<id>` games with placeholder prose ("GOG product
 * N."), so imported games showed nothing useful on the store and game pages
 * until an admin typed a description. GOG's catalogue API publishes the real
 * copy without a token:
 *
 *   GET https://api.gog.com/products/{id}?expand=description
 *
 * Live-verified Nov 2026: `description.lead` and `description.full` are HTML
 * (plain `<p>`/`<h4>`/`<img>` markup, `&nbsp;` padding), and `images` carries
 * a 2560x670 `background`, a 128x128 PNG `icon` and screenshots. The `logo`
 * is only a 100x60 galaxy strip, not a title cut-out, so `mLogoObjectId`
 * stays empty for GOG (the store-page art module owns the other art fields).
 *
 * Images are dropped from the description: the object store only mirrors
 * provider art that the desktop really shows, and product screenshots are
 * already handled by the carousel.
 */
import {
  firstParagraphAsText,
  htmlToMarkdown,
} from "../../internal/utils/html-markdown";

export type GogProductInfo = {
  title: string;
  slug: string;
  /** Raw catalogue timestamp, e.g. "2021-09-15T16:55:00+0200". */
  releaseDate: string;
  shortDescription: string;
  description: string;
};

type GogProductPayload = {
  id?: number | string;
  title?: unknown;
  slug?: unknown;
  release_date?: unknown;
  description?:
    | {
        lead?: unknown;
        full?: unknown;
        whats_cool_about_it?: unknown;
      }
    | string;
};

/** Turn one catalogue payload into the fields the game rows consume. */
export function parseGogProductInfo(
  payload: unknown,
): GogProductInfo | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const product = payload as GogProductPayload;

  const title = typeof product.title === "string" ? product.title.trim() : "";
  const slug = typeof product.slug === "string" ? product.slug.trim() : "";
  if (!title || !slug) return undefined;

  const description =
    typeof product.description === "string"
      ? { lead: product.description, full: product.description }
      : (product.description ?? {});
  const lead = typeof description.lead === "string" ? description.lead : "";
  const full = typeof description.full === "string" ? description.full : "";
  const html = full.trim() ? full : lead;

  return {
    title,
    slug,
    releaseDate:
      typeof product.release_date === "string"
        ? product.release_date.trim()
        : "",
    shortDescription: firstParagraphAsText(lead || full, 280),
    description: htmlToMarkdown(html).markdown,
  };
}

/**
 * Fetch product info for `id`. Throws on transport failures and non-2xx
 * answers (the caller decides how loud to be); returns undefined for a
 * payload without a title/slug.
 */
export async function fetchGogProductInfo(
  id: string | number,
): Promise<GogProductInfo | undefined> {
  const productId = String(id).trim();
  if (!/^[1-9]\d{0,19}$/.test(productId)) return undefined;

  const response = await fetch(
    `https://api.gog.com/products/${productId}?expand=description`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) {
    throw new Error(`GOG product ${productId} answered ${response.status}`);
  }
  return parseGogProductInfo(await response.json());
}
