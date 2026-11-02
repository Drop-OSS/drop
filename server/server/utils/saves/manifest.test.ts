import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeExpandedPath,
  constraintsMatch,
  expandSavePath,
  filesFor,
  parseLudusaviManifest,
  registryFor,
  savePathKey,
  unknownPlaceholders,
  validateLudusaviEntry,
} from "./manifest";

// Real entries from the upstream Ludusavi manifest (data/manifest.yaml,
// fetched Nov 2026), trimmed to what the parser reads. This is data-format
// adoption: the shapes below are what real imports must accept.
const ANNO_2070 = `
Anno 2070:
  files:
    "<winAppData>/Ubisoft/ANNO 2070/Accounts":
      tags:
        - save
      when:
        - os: windows
    "<winAppData>/Ubisoft/ANNO 2070/Config":
      tags:
        - config
      when:
        - os: windows
    "<winDocuments>/ANNO 2070/Accounts":
      tags:
        - save
      when:
        - os: windows
  id:
    lutris: anno-2070
  installDir:
    Anno 2070: {}
`;

const RAYMAN_ORIGINS = `
Rayman Origins:
  cloud:
    gog: true
  files:
    "<home>/Application Support/Feral Interactive/Rayman Origins/Savegame":
      tags:
        - save
      when:
        - os: mac
    "<winDocuments>/My Games/Rayman Origins/Savegame":
      tags:
        - save
      when:
        - os: windows
  gog:
    id: 1207659234
  id:
    lutris: rayman-origins
    steamExtra:
      - 207510
`;

// Far Cry 6: store-constrained saves under <root>/savegames/<storeUserId>/,
// where the Ubisoft product id (5266) names the save directory — the same
// identity the depot pipeline records games under.
const FAR_CRY_6 = `
Far Cry 6:
  cloud:
    uplay: true
  files:
    "<root>/savegames/<storeUserId>/5266":
      tags:
        - save
      when:
        - store: uplay
    "<root>/savegames/<storeUserId>/920":
      tags:
        - save
      when:
        - store: steam
        - store: uplay
    "<winDocuments>/My Games/Far Cry 6/gamerprofile.xml":
      tags:
        - config
      when:
        - os: windows
`;

test("parseLudusaviManifest reads real upstream entries", () => {
  const manifest = parseLudusaviManifest(
    [ANNO_2070, RAYMAN_ORIGINS, FAR_CRY_6].join(""),
  );
  assert.deepEqual(Object.keys(manifest).sort(), [
    "Anno 2070",
    "Far Cry 6",
    "Rayman Origins",
  ]);
  const anno = manifest["Anno 2070"];
  assert.equal(Object.keys(anno.files ?? {}).length, 3);
  assert.deepEqual(anno.installDir, { "Anno 2070": {} });
  assert.deepEqual(anno.id, { lutris: "anno-2070" });
  assert.equal(manifest["Rayman Origins"].gog?.id, 1207659234);
  assert.deepEqual(manifest["Rayman Origins"].cloud, { gog: true });
});

test("filesFor applies os constraints", () => {
  const anno = parseLudusaviManifest(ANNO_2070)["Anno 2070"];
  const windows = filesFor(anno, { os: "windows" });
  assert.equal(windows.length, 3);
  assert.ok(windows.every((file) => file.template.includes("<win")));
  const linux = filesFor(anno, { os: "linux" });
  assert.deepEqual(linux, []);
  const rayman = parseLudusaviManifest(RAYMAN_ORIGINS)["Rayman Origins"];
  assert.deepEqual(
    filesFor(rayman, { os: "mac" }).map((file) => file.template),
    ["<home>/Application Support/Feral Interactive/Rayman Origins/Savegame"],
  );
});

test("filesFor applies store constraints (Far Cry 6 uplay vs steam)", () => {
  const entry = parseLudusaviManifest(FAR_CRY_6)["Far Cry 6"];
  const uplay = filesFor(entry, { os: "windows", store: "uplay" });
  assert.deepEqual(
    uplay.map((file) => file.template).sort(),
    [
      "<root>/savegames/<storeUserId>/5266",
      "<root>/savegames/<storeUserId>/920",
      "<winDocuments>/My Games/Far Cry 6/gamerprofile.xml",
    ].sort(),
  );
  const steam = filesFor(entry, { os: "windows", store: "steam" });
  assert.ok(
    !steam.some((file) => file.template.endsWith("/5266")),
    "uplay-only saves must not match a steam context",
  );
  const noStore = filesFor(entry, { os: "windows" });
  assert.ok(
    !noStore.some((file) => file.template.includes("savegames")),
    "store-constrained templates need a store in context",
  );
});

test("registryFor matches store-only constraints", () => {
  const entry = validateLudusaviEntry("Some Game", {
    registry: {
      "HKEY_CURRENT_USER/Software/Some Game": {
        tags: ["save", "config"],
      },
      "HKEY_CURRENT_USER/Software/Steam/Some Game": {
        when: [{ store: "steam" }],
      },
    },
  });
  assert.deepEqual(
    registryFor(entry, {}).map((item) => item.key),
    ["HKEY_CURRENT_USER/Software/Some Game"],
  );
  assert.deepEqual(
    registryFor(entry, { store: "steam" }).map((item) => item.key),
    [
      "HKEY_CURRENT_USER/Software/Some Game",
      "HKEY_CURRENT_USER/Software/Steam/Some Game",
    ],
  );
});

test("expandSavePath substitutes the documented placeholders", () => {
  const vars = {
    "<winAppData>": "C:/Users/diag/AppData/Roaming",
    "<storeUserId>": "432e1048",
  };
  assert.equal(
    expandSavePath("<winAppData>/Ubisoft/ANNO 2070/Accounts", vars),
    "C:/Users/diag/AppData/Roaming/Ubisoft/ANNO 2070/Accounts",
  );
  assert.equal(
    expandSavePath("<root>/savegames/<storeUserId>/5266", {
      "<root>": "/data/games",
      ...vars,
    }),
    "/data/games/savegames/432e1048/5266",
  );
  assert.throws(
    () => expandSavePath("<frobnicate>/saves", vars),
    (error: { statusCode?: number }) => error?.statusCode === 422,
  );
});

test("unknownPlaceholders reports exactly the spec-undefined tokens", () => {
  assert.deepEqual(
    unknownPlaceholders("<root>/savegames/<storeUserId>/5266"),
    [],
  );
  assert.deepEqual(unknownPlaceholders("<bogus>/<root>/x/<bogus2>"), [
    "<bogus>",
    "<bogus2>",
  ]);
});

test("savePathKey archives the machine-independent tail", () => {
  assert.equal(
    savePathKey("<winAppData>/Ubisoft/ANNO 2070/Accounts"),
    "Ubisoft/ANNO 2070/Accounts",
  );
  assert.equal(savePathKey("<root>/savegames/<storeUserId>/5266"), "5266");
  // Backslash templates (windows data) normalize to archive slashes.
  assert.equal(
    savePathKey("<winDocuments>\\My Games\\Far Cry 6\\gamerprofile.xml"),
    "My Games/Far Cry 6/gamerprofile.xml",
  );
  // A tail smuggling traversal is refused even though the template parses.
  assert.throws(
    () => savePathKey("<winAppData>/../../evil"),
    (error: { statusCode?: number }) => error?.statusCode === 422,
  );
});

test("assertSafeExpandedPath refuses traversal and keeps roots", () => {
  assert.equal(
    assertSafeExpandedPath("C:\\Users\\diag\\Documents\\My Games\\AC3\\save"),
    "C:/Users/diag/Documents/My Games/AC3/save",
  );
  assert.equal(assertSafeExpandedPath("/x/./y//z"), "/x/y/z");
  for (const bad of ["../escape", "/x/../../escape", "a/../../b"]) {
    assert.throws(
      () => assertSafeExpandedPath(bad),
      (error: { statusCode?: number }) => error?.statusCode === 422,
      bad,
    );
  }
});

test("validateLudusaviEntry refuses hostile or malformed data", () => {
  const refuses = (raw: unknown) =>
    assert.throws(
      () => validateLudusaviEntry("X", raw),
      (error: { statusCode?: number }) => error?.statusCode === 422,
      JSON.stringify(raw),
    );
  refuses({ files: { "./local.dat": null } }); // relative path
  refuses({ files: { "../parent.dat": null } }); // relative traversal
  refuses({ files: { "<nope>/saves": null } }); // unknown placeholder
  refuses({ files: { a: { when: [{ bogus: "os" }] } } }); // unknown constraint
  refuses({ files: { a: { tags: "save" } } }); // tags must be a list
  refuses({ files: "saves" }); // files must be a mapping
  refuses({ steam: { id: "123" } }); // id must be an integer
  refuses("not a mapping");
});

test("validateLudusaviEntry passes through forward-compatible fields", () => {
  // Tools must implement schema.yaml so unknown future fields do not break
  // older tools; unknown TOP-LEVEL fields inside an entry stay data.
  const entry = validateLudusaviEntry("Future Game", {
    files: { "<base>/save": null },
    brandNewFieldFromTomorrow: { whatever: true },
  });
  assert.deepEqual(Object.keys(entry.files ?? {}), ["<base>/save"]);
  assert.equal(
    (entry as Record<string, unknown>).brandNewFieldFromTomorrow === undefined,
    false,
  );
  // Alias entries redirect and carry nothing of their own.
  assert.deepEqual(validateLudusaviEntry("Nickname", { alias: "Real Game" }), {
    alias: "Real Game",
  });
});

test("constraintsMatch treats an omitted dimension as any", () => {
  assert.equal(constraintsMatch(undefined, { os: "linux" }), true);
  assert.equal(
    constraintsMatch([{ os: "windows" }, { os: "mac" }], { os: "mac" }),
    true,
  );
  assert.equal(constraintsMatch([{ store: "steam" }], { os: "linux" }), false);
  assert.equal(
    constraintsMatch([{ store: "steam" }], { os: "linux", store: "steam" }),
    true,
  );
});

test("parseLudusaviManifest refuses documents that are not title mappings", () => {
  for (const bad of ["- just\n- a\n- list", "42", ""]) {
    assert.throws(
      () => parseLudusaviManifest(bad),
      (error: { statusCode?: number }) => error?.statusCode === 422,
      JSON.stringify(bad),
    );
  }
  assert.throws(
    () => parseLudusaviManifest("a: [1,\n  b: {oops"),
    (error: { statusCode?: number }) => error?.statusCode === 422,
  );
});
