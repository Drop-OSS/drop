import type { Localisation } from "./utils";
import {
  allLocalisableFiles,
  flattenLocalisation,
  keysFromContent,
  stripEquivalence,
} from "./utils";
import fs from "node:fs";

const files = allLocalisableFiles();

const keySet = new Map<string, string>();

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const keys = keysFromContent(content);
  keys.forEach((key) => keySet.set(key, file));
}

const localeFile: Localisation = JSON.parse(
  fs.readFileSync("./i18n/locales/en_us.json", "utf-8"),
);
const flattenedLocalisation = flattenLocalisation(localeFile);

for (const [key, file] of keySet.entries()) {
  console.log(stripEquivalence(flattenedLocalisation.get(key)!));

  if (!flattenedLocalisation.delete(key))
    throw new Error(
      `Found key "${key}" in file ${file} that doesn't exist in localisation`,
    );
}
