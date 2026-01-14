import path from "node:path";
import fs from "node:fs";
import prettier from "prettier";
const prettierConfig = JSON.parse(
  fs.readFileSync("./.prettierrc.json", "utf-8"),
);

const paths = ["./components", "./layouts", "./pages", "./server"];
const constPaths = ["error.vue", "app.vue"];
const extensions = [".vue", ".ts"];

function recursiveFindFiles(root: string): string[] {
  const results = [];
  const subpaths = fs.readdirSync(root);
  for (const subpath of subpaths) {
    const absPath = path.join(root, subpath);
    if (extensions.some((v) => absPath.endsWith(v))) {
      results.push(absPath);
      continue;
    }
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      results.push(...recursiveFindFiles(absPath));
      continue;
    }
  }
  return [...results, ...constPaths];
}

/**
 * Fetches the paths of all files available to be localised
 */
export function allLocalisableFiles(): string[] {
  const files = paths.map((k) => recursiveFindFiles(k)).flat();

  return files;
}

const I18N_UTIL_REGEX = /(?<=[^a-zA-Z]t\(\s*?["']).*?(?=["'])/g;
const I18N_KEYPATH_REGEX = /(?<=keypath=["']).*?(?=["'])/g;
/**
 * Uses regex to match all i18n keys in content
 * @param content The file content to match against
 */
export function keysFromContent(content: string): string[] {
  const matches = [
    ...content.matchAll(I18N_UTIL_REGEX),
    ...content.matchAll(I18N_KEYPATH_REGEX),
  ];
  return matches.map((v) => v[0]);
}

export type Localisation = { [key: string]: Localisation | string };

export function flattenLocalisation(localisation: Localisation) {
  const map = new Map<string, string>();
  flattenLocalisationRecursive(map, [], localisation);
  return map;
}

function flattenLocalisationRecursive(
  map: Map<string, string>,
  key: string[],
  localisationBranch: Localisation | string,
) {
  if (typeof localisationBranch === "string") {
    map.set(key.join("."), localisationBranch);
    return;
  }
  for (const [subKey, value] of Object.entries(localisationBranch)) {
    const newKey = [...key, subKey];
    flattenLocalisationRecursive(map, newKey, value);
  }
}

export function deleteLocalisation(localisation: Localisation, key: string) {
  const parts = key.split(".");
  let current: Localisation | string = localisation;
  for (const part of parts.slice(0, -1)) {
    if (typeof current === "string")
      throw new Error(`${key} not found in localisation`);
    current = current[part];
  }
  if (typeof current === "string")
    throw new Error(`${key} not found in localisation`);

  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete current[parts.at(-1)!];
}

export function fetchLocalisation(
  localisation: Localisation,
  key: string,
): string {
  const parts = key.split(".");
  let current: Localisation | string = localisation;
  for (const part of parts.slice(0, -1)) {
    if (typeof current === "string")
      throw new Error(`${key} not found in localisation`);
    current = current[part];
  }
  if (typeof current === "string")
    throw new Error(`${key} not found in localisation`);

  return current[parts.at(-1)!] as string;
}

export async function writeJSON<T>(path: string, object: T) {
  const flatStr = JSON.stringify(object);
  const formatted = await prettier.format(flatStr, {
    parser: "json",
    ...prettierConfig,
  });
  fs.writeFileSync(path, formatted);
}

/**
 * Strips some sort of English language string down to something that can be compared to be basically equivalent
 */
export function stripEquivalence(value: string): string {
  return value.replaceAll(/[.,\s]/g, "").toLowerCase();
}
