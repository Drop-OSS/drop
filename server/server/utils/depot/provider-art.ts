/**
 * Provider artwork at ingest. Store-imported games used to land with empty
 * `m*` art fields, so the desktop hero/queue/search rows showed broken
 * images. This module fetches the artwork the store itself publishes (no API
 * keys) and stages it into the object store through the same transactional
 * handler the metadata providers use, filling only the fields that are still
 * empty - a manual pick in the admin editor is never overwritten.
 *
 * Live-verified Nov 2026:
 *  - GOG's account library caches one banner hash per product
 *    (`//images-N.gog-statics.com/{hash}`, protocol-relative, extensionless);
 *    the CDN serves `{hash}.jpg` / `{hash}.png` but 404s the bare hash.
 *  - The keyless store page `https://www.gog.com/en/game/{slug}` embeds the
 *    product JSON with `boxArtImage` (portrait cover), `screenshots[]`
 *    (full-size JPEGs, hash URLs needing the same `.jpg` suffix) and a
 *    `logo` - but that is a transparent 1600x740 hero, not a title cut-out,
 *    so `mLogoObjectId` stays empty for GOG (Steam's `logo.png` is a real
 *    cut-out and fills it for Steam-sourced games).
 *  - Ubisoft's owned-titles APIs carry no artwork at all, so Ubisoft
 *    acquisitions keep empty fields until a real source exists.
 *
 * Database, object store and logger enter lazily inside `attachProviderArt`:
 * the parsing half must stay importable by hermetic unit tests, mirroring how
 * the ingest routes lazy-import the prisma machinery.
 */
export type ProviderArt = {
  /** Wide hero art (desktop game page background). */
  banner?: string;
  /** Portrait box cover (desktop queue card). */
  cover?: string;
  /** Transparent title cut-out for the hero, where the store has one. */
  logo?: string;
  /** Screenshots for the desktop carousel, in display order. */
  carousel: string[];
};

/** Screenshots per game cap: one product advertises 20+ 4K JPEGs. */
const MAX_CAROUSEL = 8;

/**
 * Bring one store image URL into a fetchable absolute URL: GOG serves the
 * protocol-relative hash only with an explicit extension appended.
 */
export function normalizeArtUrl(url: string): string | undefined {
  let value = url.trim();
  if (!value) return undefined;
  if (value.startsWith("//")) value = `https:${value}`;
  if (!/^https:\/\//i.test(value)) return undefined;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(value)) value += ".jpg";
  return value;
}

/** Art from the cached library listing alone: the banner tile, if any. */
export function cachedManifestArt(
  image: string | null | undefined,
): ProviderArt | undefined {
  const banner = image ? normalizeArtUrl(image) : undefined;
  return banner ? { banner, carousel: [] } : undefined;
}

/**
 * Pull the embedded product JSON out of a GOG store page. The main product is
 * anchored on the page's own `og:image` (related-product cards embed the same
 * fields, the meta tag is unique). Returns undefined when the page carries no
 * parseable product block - never throws on content.
 */
export function parseGogStorePage(html: string): ProviderArt | undefined {
  // The embedded JSON escapes slashes (`https:\/\/host`); a flat copy makes
  // every regex below plain.
  const page = html.replace(/\\\//g, "/");
  const og = page.match(
    /<meta\s+property="og:image"\s+content="(https:[^"]+)"/i,
  )?.[1];
  if (!og) return undefined;
  const ogHash = og
    .split("/")
    .pop()
    ?.replace(/\.[a-z]+$/i, "");
  if (!ogHash) return undefined;

  // The block stores the same URL as og:image minus the extension; a slug
  // rename could change the host, so fall back to the bare hash.
  const extensionless = og.replace(/\.[a-z]+$/i, "");
  let anchorAt = page.indexOf(`"image":"${extensionless}"`);
  if (anchorAt < 0) anchorAt = page.indexOf(`"image":"${ogHash}"`);
  if (anchorAt < 0) return undefined;

  // A product block ends at its publishers list; the cap keeps a page without
  // one from sliding into the next product's data.
  const publishersAt = page.indexOf(`"publishers"`, anchorAt);
  const end =
    publishersAt > anchorAt
      ? publishersAt
      : Math.min(page.length, anchorAt + 40_000);
  const block = page.slice(anchorAt, end);

  const banner = normalizeArtUrl(og);
  const cover = normalizeArtUrl(
    block.match(/"boxArtImage":"(https:[^"]+)"/)?.[1] ?? "",
  );
  const screenshots = [
    ...(block
      .match(/"screenshots":\[(.*?)\]/s)?.[1]
      ?.matchAll(/"(?:imageUrl|url)":"(https:[^"]+)"/g) ?? []),
  ]
    .map((m) => normalizeArtUrl(m[1] ?? "") ?? "")
    .filter(Boolean)
    .slice(0, MAX_CAROUSEL);

  if (!banner && !cover && screenshots.length === 0) return undefined;
  return {
    ...(banner ? { banner } : {}),
    ...(cover ? { cover } : {}),
    carousel: screenshots,
  };
}

/**
 * Fetch `https://www.gog.com/en/game/{slug}` and parse its product art.
 * Throws on transport failures (the caller decides how loud to be); returns
 * undefined for a slug the page does not carry a product for.
 */
export async function fetchGogStoreArt(
  slug: string,
): Promise<ProviderArt | undefined> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(slug)) return undefined;
  const response = await fetch(`https://www.gog.com/en/game/${slug}`, {
    headers: {
      // GOG serves a login interstitial to obvious non-browser agents.
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      accept: "text/html",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`GOG store page for "${slug}" answered ${response.status}`);
  }
  return parseGogStorePage(await response.text());
}

/**
 * Download `art` into the object store and attach it to `gameId`, filling
 * only fields that are still empty (an admin's manual pick wins forever).
 * The icon reuses the cover object - store art has no square variant.
 * Never throws: missing art is a cosmetic loss, not a failed acquisition.
 * Returns the number of fields attached.
 */
export async function attachProviderArt(
  gameId: string,
  art: ProviderArt,
  log?: { warn: (message: string) => void },
): Promise<number> {
  let dump: (() => void) | undefined;
  try {
    const [{ default: prisma }, { ObjectTransactionalHandler }] =
      await Promise.all([
        import("~/server/internal/db/database"),
        import("~/server/internal/objects/transactional"),
      ]);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        mIconObjectId: true,
        mBannerObjectId: true,
        mCoverObjectId: true,
        mLogoObjectId: true,
        mImageLibraryObjectIds: true,
        mImageCarouselObjectIds: true,
      },
    });
    if (!game) return 0;

    const bannerUrl =
      !game.mBannerObjectId && art.banner
        ? normalizeArtUrl(art.banner)
        : undefined;
    const coverUrl =
      !game.mCoverObjectId && art.cover
        ? normalizeArtUrl(art.cover)
        : undefined;
    const logoUrl =
      !game.mLogoObjectId && art.logo ? normalizeArtUrl(art.logo) : undefined;
    const screenshotUrls = game.mImageCarouselObjectIds.length
      ? []
      : art.carousel
          .map((u) => normalizeArtUrl(u))
          .filter((u): u is string => !!u)
          .slice(0, MAX_CAROUSEL);
    if (!bannerUrl && !coverUrl && !logoUrl && screenshotUrls.length === 0)
      return 0;

    const [register, pull, dumpFn] = new ObjectTransactionalHandler().new(
      {},
      ["internal:read"],
      undefined,
    );
    dump = dumpFn;
    const bannerId = bannerUrl ? register(bannerUrl) : undefined;
    const newCoverId = coverUrl ? register(coverUrl) : undefined;
    const logoId = logoUrl ? register(logoUrl) : undefined;
    const shotIds = screenshotUrls.map((url) => register(url));
    await pull();

    const iconId = !game.mIconObjectId
      ? newCoverId || game.mCoverObjectId
      : undefined;
    const pool = [bannerId, newCoverId, ...shotIds].filter(
      (id): id is string => !!id,
    );

    const data = {
      ...(iconId ? { mIconObjectId: iconId } : {}),
      ...(bannerId && !game.mBannerObjectId
        ? { mBannerObjectId: bannerId }
        : {}),
      ...(newCoverId ? { mCoverObjectId: newCoverId } : {}),
      ...(logoId ? { mLogoObjectId: logoId } : {}),
      ...(game.mImageLibraryObjectIds.length || pool.length === 0
        ? {}
        : { mImageLibraryObjectIds: pool }),
      ...(shotIds.length ? { mImageCarouselObjectIds: shotIds } : {}),
    };
    if (Object.keys(data).length === 0) return 0;
    const updated = await prisma.game.updateMany({
      where: { id: gameId },
      data,
    });
    if (updated.count !== 1)
      throw new Error(`art update matched ${updated.count} rows, expected 1`);
    return Object.keys(data).length;
  } catch (e) {
    dump?.();
    (log ?? console).warn(
      `provider art for game ${gameId} failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return 0;
  }
}
