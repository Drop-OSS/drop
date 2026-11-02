import { test } from "node:test";
import assert from "node:assert/strict";
import { create, toBinary } from "@bufbuild/protobuf";
import { deflateSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  ChunkSchema,
  Chunk_ChunkType,
  FileSchema,
  ManifestSchema,
  SliceSchema,
} from "../../internal/proto/ubisoft-demux/proto/download_pb";
import {
  buildUbisoftDownloadPlan,
  deriveUbisoftLaunches,
  fileHashToPathChar,
  parseUbisoftManifest,
  sha1Hex,
  sliceCdnPath,
  sliceCdnPathCandidates,
} from "./manifest";

/** The fixed header size the CDN puts in front of every manifest payload. */
const HEADER = Buffer.alloc(356, 7);

/** Raw 20-byte SHA-1 of a string, as the manifest stores slice hashes. */
function sha1Bytes(text: string): Uint8Array {
  return new Uint8Array(
    createHash("sha1")
      .update(text)
      .digest("hex")
      .match(/../g)!
      .map((hex) => parseInt(hex, 16)),
  );
}

const sha1Of = (text: string): string => sha1Hex(Buffer.from(text));

/** Build a CDN manifest blob from a manifest message + framing function. */
function manifestBlob(
  payload: Buffer,
  wrap: (bytes: Buffer) => Buffer = (b) => Buffer.from(deflateSync(b)),
): Buffer {
  return Buffer.concat([HEADER, wrap(payload)]);
}

function minimalManifestPayload(): Buffer {
  return Buffer.from(
    toBinary(
      ManifestSchema,
      create(ManifestSchema, {
        chunks: [
          create(ChunkSchema, {
            id: 1,
            type: Chunk_ChunkType.ChunkType_Required,
            files: [
              create(FileSchema, {
                name: "Anno5.exe",
                size: 4n,
                isDir: false,
                slices: [sha1Bytes("slice-a")],
                sliceList: [create(SliceSchema, { size: 4 })],
              }),
            ],
          }),
        ],
      }),
    ),
  );
}

test("parseUbisoftManifest inflates the zlib framing older titles ship", () => {
  const manifest = parseUbisoftManifest(manifestBlob(minimalManifestPayload()));
  assert.equal(manifest.chunks.length, 1);
  assert.equal(manifest.chunks[0].files[0].name, "Anno5.exe");
});

test("parseUbisoftManifest accepts the gzip framing modern titles ship", () => {
  const manifest = parseUbisoftManifest(
    manifestBlob(minimalManifestPayload(), (b) => Buffer.from(gzipSync(b))),
  );
  assert.equal(manifest.chunks[0].files[0].name, "Anno5.exe");
});

test("parseUbisoftManifest refuses payloads that are not game manifests", () => {
  const junk = Buffer.concat([HEADER, Buffer.from("not a manifest at all")]);
  assert.throws(
    () => parseUbisoftManifest(junk),
    (error: { statusCode?: number }) => error?.statusCode === 502,
  );
  assert.throws(
    () => parseUbisoftManifest(HEADER.subarray(0, 100)),
    (error: { statusCode?: number }) => error?.statusCode === 502,
  );
});

test("fileHashToPathChar maps hash prefixes through the launcher's base32 table", () => {
  // Vectors verified against the launcher-side reference implementations
  // (ubisoft-demux-node and ubi-cli-mvp, both live-proven): byte built from
  // the first two hex digits swapped, alphabet position v/16 + (v odd ? 16 : 0).
  assert.equal(
    fileHashToPathChar("33416BDD719B92CFD793FF4692E02FF498A04A30"),
    "j",
  ); // 0x33=51 odd -> 3+16
  assert.equal(fileHashToPathChar("10AABBCC"), "g"); // swapped byte 0x01 -> 16
  assert.equal(fileHashToPathChar("20AABBCC"), "0"); // swapped byte 0x02 -> 0
  assert.equal(fileHashToPathChar("0FAABBCC"), "f"); // swapped byte 0xf0=240 -> 15
});

test("fileHashToPathChar output always lands in the base32 CDN alphabet", () => {
  const alphabet = new Set("0123456789abcdefghijklmnopqrstuv".split(""));
  for (let first = 0; first < 256; first++) {
    for (const second of [0x00, 0xff]) {
      const hash = `${first.toString(16).padStart(2, "0")}${second
        .toString(16)
        .padStart(2, "0")}aabbcc`.toUpperCase();
      assert.ok(alphabet.has(fileHashToPathChar(hash)), `char for ${hash}`);
    }
  }
});

test("sliceCdnPath builds the slices_v3/<char>/<HASH> request path", () => {
  const hash = sha1Of("slice-body");
  assert.equal(
    sliceCdnPath(hash),
    `slices_v3/${fileHashToPathChar(hash)}/${hash}`,
  );
});

test("sliceCdnPathCandidates leads with the computed path and covers all 32", () => {
  const hash = sha1Of("slice-body").toLowerCase();
  const candidates = sliceCdnPathCandidates(hash);
  assert.equal(candidates.length, 32);
  assert.equal(new Set(candidates).size, 32);
  assert.equal(candidates[0], sliceCdnPath(hash.toUpperCase()));
});

/** One-file manifest message carrying the given slices for a 10-byte file. */
type PlanSlice = {
  content: string;
  size: number;
  download?: string;
  offset?: bigint;
};

function planFixture(options: {
  slices: PlanSlice[];
  chunkType?: Chunk_ChunkType;
  language?: string;
  fileNames?: string[];
}) {
  const names = options.fileNames ?? options.slices.map(() => "game/bin.exe");
  const perFile = new Map<string, PlanSlice[]>();
  options.slices.forEach((slice, index) => {
    const list = perFile.get(names[index]) ?? [];
    list.push(slice);
    perFile.set(names[index], list);
  });
  return create(ManifestSchema, {
    chunks: [
      create(ChunkSchema, {
        id: 1,
        type: options.chunkType ?? Chunk_ChunkType.ChunkType_Required,
        language: options.language ?? "",
        files: [...perFile.entries()].map(([name, slices]) =>
          create(FileSchema, {
            name,
            size: 10n,
            isDir: false,
            slices: slices.map((slice) => sha1Bytes(slice.content)),
            sliceList: slices.map((slice) =>
              create(SliceSchema, {
                size: slice.size,
                downloadSha1: slice.download
                  ? sha1Bytes(slice.download)
                  : new Uint8Array(),
                fileOffset: slice.offset ?? 0n,
              }),
            ),
          }),
        ),
      }),
    ],
  });
}

test("buildUbisoftDownloadPlan treats all-zero offsets as sequential", () => {
  const plan = buildUbisoftDownloadPlan(
    planFixture({
      slices: [
        { content: "part-one", size: 6 },
        { content: "part-two", size: 4 },
      ],
    }),
  );
  assert.equal(plan.files.length, 1);
  const [file] = plan.files;
  assert.equal(file.path, "game/bin.exe");
  assert.deepEqual(
    file.slices.map((slice) => slice.offset),
    [0, 6],
  );
  assert.equal(plan.totalBytes, 10);
  assert.equal(plan.totalSlices, 2);
  // No downloadSha1: the CDN path uses the content hash.
  assert.equal(file.slices[0].cdnPath, sliceCdnPath(sha1Of("part-one")));
  assert.equal(file.slices[0].verifySha1, sha1Of("part-one"));
});

test("buildUbisoftDownloadPlan keeps explicit offsets and download-hash paths", () => {
  const plan = buildUbisoftDownloadPlan(
    planFixture({
      slices: [
        { content: "a", size: 4, offset: 6n },
        { content: "b", size: 6, offset: 0n },
      ],
    }),
  );
  const [file] = plan.files;
  assert.deepEqual(
    file.slices.map((slice) => slice.offset),
    [6, 0],
  );
});

test("buildUbisoftDownloadPlan fetches slices by downloadSha1 when declared", () => {
  const plan = buildUbisoftDownloadPlan(
    planFixture({
      slices: [{ content: "content-hash", size: 10, download: "wire-bytes" }],
    }),
  );
  const [slice] = plan.files[0].slices;
  assert.equal(slice.cdnPath, sliceCdnPath(sha1Of("wire-bytes")));
  assert.equal(slice.verifySha1, sha1Of("content-hash"));
});

test("buildUbisoftDownloadPlan skips optional chunks but keeps the wanted language", () => {
  const manifest = create(ManifestSchema, {
    chunks: [
      create(ChunkSchema, {
        id: 1,
        type: Chunk_ChunkType.ChunkType_Required,
        files: [
          create(FileSchema, {
            name: "base.exe",
            size: 1n,
            isDir: false,
            slices: [sha1Bytes("req")],
            sliceList: [create(SliceSchema, { size: 1 })],
          }),
        ],
      }),
      create(ChunkSchema, {
        id: 2,
        type: Chunk_ChunkType.ChunkType_Optional,
        files: [
          create(FileSchema, {
            name: "hd_video.dat",
            size: 1n,
            isDir: false,
            slices: [sha1Bytes("opt")],
            sliceList: [create(SliceSchema, { size: 1 })],
          }),
        ],
      }),
      create(ChunkSchema, {
        id: 3,
        type: Chunk_ChunkType.ChunkType_Optional,
        language: "de-DE",
        files: [
          create(FileSchema, {
            name: "audio_de.dat",
            size: 1n,
            isDir: false,
            slices: [sha1Bytes("de")],
            sliceList: [create(SliceSchema, { size: 1 })],
          }),
        ],
      }),
      create(ChunkSchema, {
        id: 4,
        type: Chunk_ChunkType.ChunkType_Optional,
        language: "en-US",
        files: [
          create(FileSchema, {
            name: "audio_en.dat",
            size: 1n,
            isDir: false,
            slices: [sha1Bytes("en")],
            sliceList: [create(SliceSchema, { size: 1 })],
          }),
        ],
      }),
    ],
  });
  const plan = buildUbisoftDownloadPlan(manifest, "en-US");
  assert.deepEqual(plan.files.map((file) => file.path).sort(), [
    "audio_en.dat",
    "base.exe",
  ]);
  const russian = buildUbisoftDownloadPlan(manifest, "ru-RU");
  assert.deepEqual(
    russian.files.map((file) => file.path),
    ["base.exe"],
  );
});

test("buildUbisoftDownloadPlan keeps empty placeholder files", () => {
  const plan = buildUbisoftDownloadPlan(
    create(ManifestSchema, {
      chunks: [
        create(ChunkSchema, {
          id: 1,
          type: Chunk_ChunkType.ChunkType_Required,
          files: [
            create(FileSchema, {
              name: "data/config/game/dump.txt",
              size: 0n,
              isDir: false,
            }),
          ],
        }),
      ],
    }),
  );
  assert.deepEqual(plan.files, [{ path: "data/config/game/dump.txt", size: 0, slices: [] }]);
  assert.equal(plan.totalBytes, 0);
  assert.equal(plan.totalSlices, 0);
});

test("buildUbisoftDownloadPlan rejects unsafe manifest paths", () => {
  for (const name of ["../escape.exe", "/etc/passed.exe", "game/../evil.bin"]) {
    assert.throws(
      () =>
        buildUbisoftDownloadPlan(
          planFixture({
            slices: [{ content: "x", size: 10 }],
            fileNames: [name],
          }),
        ),
      (error: { statusCode?: number }) => error?.statusCode === 502,
      name,
    );
  }
  // Windows separators normalise instead of being refused.
  const plan = buildUbisoftDownloadPlan(
    planFixture({
      slices: [{ content: "x", size: 10 }],
      fileNames: ["data\\config\\settings.ini"],
    }),
  );
  assert.equal(plan.files[0].path, "data/config/settings.ini");
});

test("buildUbisoftDownloadPlan rejects slice descriptor/hash mismatch", () => {
  assert.throws(
    () =>
      buildUbisoftDownloadPlan(
        create(ManifestSchema, {
          chunks: [
            create(ChunkSchema, {
              id: 1,
              type: Chunk_ChunkType.ChunkType_Required,
              files: [
                create(FileSchema, {
                  name: "broken.bin",
                  size: 5n,
                  isDir: false,
                  slices: [sha1Bytes("one")],
                  sliceList: [create(SliceSchema, { size: 5 })],
                }),
                create(FileSchema, {
                  name: "mismatch.bin",
                  size: 5n,
                  isDir: false,
                  slices: [sha1Bytes("one"), sha1Bytes("two")],
                  sliceList: [create(SliceSchema, { size: 5 })],
                }),
              ],
            }),
          ],
        }),
      ),
    (error: { statusCode?: number }) => error?.statusCode === 502,
  );
});

// The real ownership-service install configuration for Anno 2070 (pid 22),
// captured live Nov 2026, trimmed to the structure the scanner reads.
const ANNO_2070_CONFIG = `version: 2.0
root:
  name: Anno 2070
  background_image: dab54ae00427d76aa3cf655c4f8c4dde.jpg
  icon_image: fb2ebde69f7640f2ac8d00752b8a60bb.ico
  start_game:
    online:
      overlay_required: yes
      overlay_supported: yes
      executables:
      - shortcut_name: Anno2070
        path:
          relative: Anno5.exe
        working_directory:
          register: HKEY_LOCAL_MACHINE\\SOFTWARE\\Ubisoft\\Launcher\\Installs\\22\\InstallDir
        denuvo: yes
      pc_bang: {}
    offline:
      executables:
      - shortcut_name: Anno2070
        path:
          relative: Anno5.exe
        working_directory:
          register: HKEY_LOCAL_MACHINE\\SOFTWARE\\Ubisoft\\Launcher\\Installs\\22\\InstallDir
  rpe_available: yes
`;

test("deriveUbisoftLaunches reads title and relative executables from the real config", () => {
  const { title, launches } = deriveUbisoftLaunches(ANNO_2070_CONFIG);
  assert.equal(title, "Anno 2070");
  // online wins; the offline twin dedupes to one entry.
  assert.deepEqual(launches, [
    { name: "Anno2070", executable: "Anno5.exe", arguments: [] },
  ]);
});

test("deriveUbisoftLaunches falls back to offline executables", () => {
  const yaml = `root:
  name: Offline Game
  start_game:
    offline:
      executables:
      - shortcut_name: PlayOffline
        path:
          relative: game_offline.exe
`;
  const { title, launches } = deriveUbisoftLaunches(yaml);
  assert.equal(title, "Offline Game");
  assert.deepEqual(launches, [
    { name: "PlayOffline", executable: "game_offline.exe", arguments: [] },
  ]);
});

test("deriveUbisoftLaunches skips register-path executables and dedupes", () => {
  const yaml = `root:
  name: Registry Game
  start_game:
    online:
      executables:
      - shortcut_name: Registered
        path:
          register: HKEY_LOCAL_MACHINE\\SOFTWARE\\Whatever
      - shortcut_name: Dup
        path:
          relative: a.exe
      - shortcut_name: Dup
        path:
          relative: a.exe
      - shortcut_name: Second
        path:
          relative: sub\\b.exe
`;
  const { launches } = deriveUbisoftLaunches(yaml);
  assert.deepEqual(launches, [
    { name: "Dup", executable: "a.exe", arguments: [] },
    { name: "Second", executable: "sub/b.exe", arguments: [] },
  ]);
});

// The legacy config generation (Rayman Origins pid 80 / AC3 pid 54,
// captured live Nov 2026): entries start at `- path:`, labels arrive via
// `description:`, and entries may carry `arguments:`. Trailing spaces after
// `path:` appear in the real service output.
const LEGACY_CONFIG = `root:
  name: "Rayman Origins"
  sort_string: "Rayman 5"
  start_game:
    online:
      after_game_report_enabled: no
      executables:
        - path: 
            relative: Rayman Origins.exe
          working_directory:
            register: HKEY_LOCAL_MACHINE\\SOFTWARE\\UBISOFT\\Rayman Origins\\GameUpdate\\InstallDir
    offline:
      executables:
        - path:
            relative: Rayman Origins.exe
          arguments: -offline
`;

const AC3_CONFIG = `root:
  name: l1
  sort_string: Assassin's Creed 05.1
  start_game:
    online:
      legacy_ticket_enabled: yes
      executables:
        - path:
            relative: AC3SP.exe
          working_directory:
            register: HKEY_LOCAL_MACHINE\\SOFTWARE\\UBISOFT\\Assassin's Creed 3\\GameUpdate\\installdir
          internal_name: Executable
          description: Single Player
        - path:
            relative: AC3MP.exe
          internal_name: Executable
          description: Multi Player
    offline:
      executables:
        - path:
            relative: AC3SP.exe
          arguments: -offline
          description: Single Player
`;

test("deriveUbisoftLaunches reads the legacy dash-path generation", () => {
  const { title, launches } = deriveUbisoftLaunches(LEGACY_CONFIG);
  assert.equal(title, "Rayman Origins");
  assert.deepEqual(launches, [
    { name: "Play", executable: "Rayman Origins.exe", arguments: [] },
  ]);
});

test("deriveUbisoftLaunches labels legacy entries from description and keeps online args", () => {
  const { launches } = deriveUbisoftLaunches(AC3_CONFIG);
  assert.deepEqual(launches, [
    { name: "Single Player", executable: "AC3SP.exe", arguments: [] },
    { name: "Multi Player", executable: "AC3MP.exe", arguments: [] },
  ]);
});

test("deriveUbisoftLaunches carries offline arguments when offline is used", () => {
  const offlineOnly = AC3_CONFIG.replace(
    /    online:\n[\s\S]*?\n    offline:/,
    "    offline:",
  );
  const { launches } = deriveUbisoftLaunches(offlineOnly);
  assert.deepEqual(launches, [
    { name: "Single Player", executable: "AC3SP.exe", arguments: ["-offline"] },
  ]);
});

test("deriveUbisoftLaunches survives configs without start_game", () => {
  const { title, launches } = deriveUbisoftLaunches(
    "root:\n  name: Bare\n  icon_image: x.ico\n",
  );
  assert.equal(title, "Bare");
  assert.deepEqual(launches, []);
});
