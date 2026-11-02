import { createError } from "h3";
import { parse as parseYaml } from "yaml";

/**
 * Ludusavi manifest entries: the community-standard shape for "where does this
 * game keep its saves". GameDepot adopts the DATA FORMAT (YAML entries with
 * `<placeholder>` path templates, `when` constraints and tags, see
 * https://github.com/mtkennerly/ludusavi-manifest) — this parser, validator
 * and expander are ours and tested against real upstream entries.
 *
 * The spec's rules implemented here:
 *  - paths are templates first and globs second (`<root>/savegames/<storeUserId>/5266`)
 *  - a path template must use the placeholder vocabulary below; unknown
 *    placeholders are refused at import time, not silently kept
 *  - relative paths (`./`, `../`) never appear in valid entries (spec: the
 *    primary manifest never contains them; secondary manifests must use `<base>`)
 *  - file constraints (`when`) match on os/store; an omitted dimension is
 *    "any". An entry without `when` applies everywhere (spec note: tools may
 *    still check inapplicable entries — matching here is per the stated shape).
 *  - `alias` entries redirect to another title and carry no paths of their own.
 */

export type SaveOs = "windows" | "linux" | "mac";

export type FileConstraint = { os?: string; store?: string };

export type ManifestFileEntry = { tags?: string[]; when?: FileConstraint[] };

export type ManifestRegistryEntry = {
  tags?: string[];
  when?: { store?: string }[];
};

/** One entry under a game title in the upstream `manifest.yaml`. */
export type LudusaviEntry = {
  files?: Record<string, ManifestFileEntry | null>;
  registry?: Record<string, ManifestRegistryEntry | null>;
  installDir?: Record<string, unknown>;
  launch?: Record<string, unknown>;
  steam?: { id?: number };
  gog?: { id?: number };
  id?: Record<string, unknown>;
  alias?: string;
  cloud?: Record<string, boolean>;
};

/**
 * The placeholder vocabulary (ludusavi-manifest README table). Expansion
 * itself happens on the client, which owns the real paths; the server uses
 * this set to validate entries and to derive archive keys.
 */
export const SAVE_PATH_PLACEHOLDERS = [
  "<root>",
  "<game>",
  "<base>",
  "<home>",
  "<storeGameId>",
  "<storeUserId>",
  "<osUserName>",
  "<winAppData>",
  "<winLocalAppData>",
  "<winLocalAppDataLow>",
  "<winDocuments>",
  "<winPublic>",
  "<winProgramData>",
  "<winDir>",
  "<xdgData>",
  "<xdgConfig>",
] as const;

const PLACEHOLDER_TOKEN = /<([A-Za-z][A-Za-z0-9]*)>/g;

/** Every placeholder used by `path` that the spec does not define. */
export function unknownPlaceholders(path: string): string[] {
  const known = new Set<string>(SAVE_PATH_PLACEHOLDERS);
  const found: string[] = [];
  for (const match of path.matchAll(PLACEHOLDER_TOKEN)) {
    const token = `<${match[1]}>`;
    if (!known.has(token) && !found.includes(token)) found.push(token);
  }
  return found;
}

/**
 * Substitute placeholders from `vars` (keys include the angle brackets, e.g.
 * `{"<winAppData>": "C:/Users/x/AppData/Roaming"}`). Unknown placeholders are
 * a hard error — imports are validated, so reaching one means corrupt data.
 */
export function expandSavePath(
  path: string,
  vars: Record<string, string>,
): string {
  const missing = unknownPlaceholders(path);
  if (missing.length > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: `Save path template uses unknown placeholder(s) ${missing.join(", ")}: ${path}`,
    });
  }
  return path.replace(PLACEHOLDER_TOKEN, (token) => vars[token] ?? "");
}

/**
 * Normalize one expanded path and prove it cannot climb out of the save root:
 * separators unified, `.` segments dropped, any `..` segment refused, and the
 * original absolute-ness kept (it is the client's root that decides placement).
 */
export function assertSafeExpandedPath(expanded: string): string {
  if (expanded.includes("\0") || expanded.trim() === "") {
    throw createError({
      statusCode: 422,
      statusMessage: "Save path is empty or contains NUL bytes",
    });
  }
  const unified = expanded.replaceAll("\\", "/");
  // Rooted paths stay rooted: the client's root decides placement, but an
  // expanded path that WAS absolute must not silently become relative.
  const absolute = unified.startsWith("/");
  const segments: string[] = [];
  for (const segment of unified.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      throw createError({
        statusCode: 422,
        statusMessage: `Save path escapes its root: ${expanded}`,
      });
    }
    segments.push(segment);
  }
  if (segments.length === 0) {
    throw createError({
      statusCode: 422,
      statusMessage: `Save path has no content after normalization: ${expanded}`,
    });
  }
  return (absolute ? "/" : "") + segments.join("/");
}

/**
 * The archive key a matched save file lands under: the template's tail after
 * its LAST placeholder (e.g. `<winAppData>/Ubisoft/ANNO 2070/Accounts` →
 * `Ubisoft/ANNO 2070/Accounts`). The machine-local part is deliberately NOT
 * archived — roots differ per device/user, the tail is what identifies the
 * file, and keeping usernames and drive letters out makes restores portable
 * between Windows/Linux/macOS and between accounts.
 */
export function savePathKey(template: string): string {
  const tokens = template.match(/<([A-Za-z][A-Za-z0-9]*)>/g) ?? [];
  let tail =
    tokens.length === 0
      ? template
      : template.slice(
          (template.lastIndexOf(tokens[tokens.length - 1]) ?? -1) +
            tokens[tokens.length - 1].length,
        );
  // Everything after the last placeholder is relative to that root on the
  // client; as an archive key the leading separator is noise.
  tail = tail.replace(/^[\\/]+/, "");
  // The tail must not smuggle traversal either (a template ending in
  // `<winAppData>/../../evil` is hostile data even with a clean root).
  return assertSafeExpandedPath(tail);
}

function plainObject(
  value: unknown,
  what: string,
): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createError({
      statusCode: 422,
      statusMessage: `${what} must be a mapping`,
    });
  }
  return value as Record<string, unknown>;
}

function stringList(value: unknown, what: string): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw createError({
      statusCode: 422,
      statusMessage: `${what} must be a list of strings`,
    });
  }
  return [...(value as string[])];
}

function validateConstraints(
  value: unknown,
  what: string,
  allowOs: boolean,
): FileConstraint[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 422,
      statusMessage: `${what} must be a list`,
    });
  }
  return value.map((raw, index) => {
    const obj = plainObject(raw, `${what}[${index}]`) ?? {};
    const out: FileConstraint = {};
    for (const [key, item] of Object.entries(obj)) {
      if (key !== "os" && key !== "store") {
        throw createError({
          statusCode: 422,
          statusMessage: `${what}[${index}] has unknown constraint ${key}`,
        });
      }
      if (key === "os" && !allowOs) {
        throw createError({
          statusCode: 422,
          statusMessage: `${what}[${index}] cannot constrain on os`,
        });
      }
      if (typeof item !== "string") {
        throw createError({
          statusCode: 422,
          statusMessage: `${what}[${index}].${key} must be a string`,
        });
      }
      out[key] = item;
    }
    return out;
  });
}

/**
 * Validate one entry of a Ludusavi manifest (per schema.yaml, leniently:
 * unknown TOP-LEVEL entry fields pass through, unknown constraint keys and
 * malformed shapes do not — those change how files are found).
 */
export function validateLudusaviEntry(
  title: string,
  raw: unknown,
): LudusaviEntry {
  const entry = (plainObject(raw, `Manifest entry ${title}`) ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof entry.alias === "string" && entry.alias !== "") {
    return { alias: entry.alias };
  }
  // Start from the raw entry so fields this parser does not know yet survive
  // intact (schema.yaml asks tools to ignore what they do not understand);
  // every known field is then replaced by its validated+normalized version.
  const out = { ...entry } as Record<string, unknown> & LudusaviEntry;
  const files = plainObject(entry.files, `files of ${title}`);
  if (files) {
    out.files = {};
    for (const [template, value] of Object.entries(files)) {
      if (template.trim() === "") {
        throw createError({
          statusCode: 422,
          statusMessage: `${title}: empty file path in manifest entry`,
        });
      }
      if (template.startsWith("./") || template.startsWith("../")) {
        throw createError({
          statusCode: 422,
          statusMessage: `${title}: relative save path ${template} (use <base>/...)`,
        });
      }
      const unknown = unknownPlaceholders(template);
      if (unknown.length > 0) {
        throw createError({
          statusCode: 422,
          statusMessage: `${title}: unknown placeholder(s) ${unknown.join(", ")} in ${template}`,
        });
      }
      const valueObj = plainObject(value, `${title}: ${template}`);
      out.files[template] = {
        tags: stringList(valueObj?.tags, `${title}: ${template}.tags`),
        when: validateConstraints(
          valueObj?.when,
          `${title}: ${template}.when`,
          true,
        ),
      };
    }
  }
  const registry = plainObject(entry.registry, `registry of ${title}`);
  if (registry) {
    out.registry = {};
    for (const [key, value] of Object.entries(registry)) {
      const valueObj = plainObject(value, `${title}: registry ${key}`);
      out.registry[key] = {
        tags: stringList(valueObj?.tags, `${title}: registry ${key}.tags`),
        when: validateConstraints(
          valueObj?.when,
          `${title}: registry ${key}.when`,
          false,
        ),
      };
    }
  }
  // Pass-through fields the spec allows tools to carry but not act on.
  for (const key of ["installDir", "launch", "id"] as const) {
    const value = plainObject(entry[key], `${key} of ${title}`);
    if (value) (out as Record<string, unknown>)[key] = value;
  }
  for (const key of ["steam", "gog"] as const) {
    const value = plainObject(entry[key], `${key} of ${title}`);
    if (value) {
      if (
        value.id !== undefined &&
        !(typeof value.id === "number" && Number.isSafeInteger(value.id))
      ) {
        throw createError({
          statusCode: 422,
          statusMessage: `${title}: ${key}.id must be an integer`,
        });
      }
      out[key] = { id: value.id as number | undefined };
    }
  }
  if (typeof entry.cloud === "object" && entry.cloud !== null) {
    out.cloud = entry.cloud as Record<string, boolean>;
  }
  return out;
}

/**
 * Parse a whole Ludusavi manifest document (the upstream `manifest.yaml`, or
 * any subset of it, or a curated file) into validated entries.
 */
export function parseLudusaviManifest(
  text: string,
): Record<string, LudusaviEntry> {
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    throw createError({
      statusCode: 422,
      statusMessage: "Save manifest is not valid YAML",
    });
  }
  const root = plainObject(doc, "Save manifest");
  if (!root) {
    throw createError({
      statusCode: 422,
      statusMessage: "Save manifest must be a mapping of game titles",
    });
  }
  const out: Record<string, LudusaviEntry> = {};
  for (const [title, raw] of Object.entries(root)) {
    out[title] = validateLudusaviEntry(title, raw);
  }
  return out;
}

/** Resolve `when` constraints for one os/store context (any missing dimension matches all). */
export function constraintsMatch(
  when: FileConstraint[] | undefined,
  ctx: { os: SaveOs; store?: string },
): boolean {
  if (!when || when.length === 0) return true;
  return when.some(
    (constraint) =>
      (constraint.os === undefined || constraint.os === ctx.os) &&
      (constraint.store === undefined ||
        (ctx.store !== undefined && constraint.store === ctx.store)),
  );
}

/** The file templates that apply in a device context, with their tags. */
export function filesFor(
  entry: LudusaviEntry,
  ctx: { os: SaveOs; store?: string },
): { template: string; tags: string[] }[] {
  const out: { template: string; tags: string[] }[] = [];
  for (const [template, value] of Object.entries(entry.files ?? {})) {
    if (constraintsMatch(value?.when, ctx)) {
      out.push({ template, tags: value?.tags ?? [] });
    }
  }
  return out;
}

/** Registry keys applying in a device context (windows-only consumer). */
export function registryFor(
  entry: LudusaviEntry,
  ctx: { store?: string },
): { key: string; tags: string[] }[] {
  const out: { key: string; tags: string[] }[] = [];
  for (const [key, value] of Object.entries(entry.registry ?? {})) {
    if (constraintsMatch(value?.when, { os: "windows", ...ctx })) {
      out.push({ key, tags: value?.tags ?? [] });
    }
  }
  return out;
}
