import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Neutral "no artwork" tiles. A game with empty `m*` object ids is normal
 * (manual entries, stores without a keyless art source), so its rows must
 * read as "no art", not as a broken image. The data URIs keep the fallback
 * independent of the network and of the asset protocol.
 *
 * `xMidYMid slice` makes the fixed viewBox behave like `object-cover` when
 * the host <img> box has a different aspect (square icon vs wide hero), and
 * the glyph stays centered so it survives the crop.
 */
function placeholder(body: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="#27272a"/><g fill="none" stroke="#52525b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`,
  )}`;
}

const PLACEHOLDER_ART = placeholder(
  `<circle cx="128" cy="72" r="20"/><path d="M40 148l64-64 44 44 36-32 96 84H40z"/>`,
);

const PLACEHOLDER_AVATAR = placeholder(
  `<circle cx="160" cy="70" r="34"/><path d="M92 152c10-34 36-50 68-50s58 16 68 50"/>`,
);

export const useObject = (id: string) => {
  return convertFileSrc(id, "object");
};

/** Asset URL for `id`, or a neutral tile when there is no object behind it. */
export const useObjectOrPlaceholder = (id: string | null | undefined) =>
  id ? useObject(id) : PLACEHOLDER_ART;

/** Avatar variant: same idea, person glyph. */
export const useObjectOrAvatarPlaceholder = (id: string | null | undefined) =>
  id ? useObject(id) : PLACEHOLDER_AVATAR;
