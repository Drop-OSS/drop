import fs from "node:fs";
import type { Localisation } from "./utils";
import {
  allLocalisableFiles,
  fetchLocalisation,
  keysFromContent,
} from "./utils";

const files = allLocalisableFiles();
const localeFile: Localisation = JSON.parse(
  fs.readFileSync("./i18n/locales/en_us.json", "utf-8"),
);

const keepPrefixes = ["error", "common", "chars"];
const keyMap: Map<string, string> = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const keys = keysFromContent(content);

  const fileNoExtension = file.slice(0, file.lastIndexOf("."));

  for (const key of keys) {
    const _value = fetchLocalisation(localeFile, key);

    const newKeySuffix = key.split(".").slice(-1); /*value
      .replaceAll(/[^a-zA-Z\s]/g, "")
      .toLowerCase()
      .split(" ")
      .slice(0, 3)
      .map((v, i) =>
        v
          ? i > 0
            ? v[0].toUpperCase() + v.slice(1)
            : v
          : key.split(".").slice(-1),
      )
      .join("");*/

    const newKey = [
      ...fileNoExtension
        .replaceAll(/[^a-zA-Z0-9/]/g, "")
        .toLowerCase()
        .split("/"),
      newKeySuffix,
    ].join(".");

    const finalKey = keepPrefixes.some((v) => key.startsWith(v)) ? key : newKey;

    keyMap.set(key, finalKey);
  }
}

console.log(keyMap);
