/**
 * Dev probe: dump the per-slice encoding of one live Ubisoft install
 * manifest, to pin down which generations put the real slice hashes where.
 *
 *   docker exec -e UBI_TICKET=<sealed> -e GAMEDEPOT_CREDENTIAL_KEY=... \
 *     -e UBI_PID=540 gamedepot-builder \
 *     sh -c 'cd /app/server && ./node_modules/.bin/tsx scripts/probe-slice-shape.ts'
 *
 * For each acquirable file reports: `File.slices` entry byte lengths (the
 * content hashes the streamer verifies against) and the `File.sliceList`
 * descriptor fields (size/downloadSize/downloadSha1/fileOffset). An optional
 * FETCH=1 run also downloads the first slice and reports raw/decompressed
 * SHA-1s and magic bytes - the ground truth for the verification gate.
 */
import { openSecret } from "../server/utils/depot/credential-crypto";
import { UbisoftAcquisitionClient } from "../server/utils/ubisoft/demux/acquisition";
import {
  parseUbisoftManifest,
  sliceCdnPath,
  sha1Hex,
} from "../server/utils/ubisoft/manifest";
import { decompressSliceBody } from "../server/utils/ubisoft/game-streamer";

const pid = Number(process.env.UBI_PID ?? "540");
const fetchFirst = process.env.FETCH === "1";
const SAMPLE_FILES = 4;

const hexOf = (bytes: Uint8Array): string =>
  bytes.byteLength === 0 ? "-" : Buffer.from(bytes).toString("hex");

const ticket = openSecret(process.env.UBI_TICKET ?? null);
if (!ticket) throw new Error("UBI_TICKET (sealed value) required");
const client = await UbisoftAcquisitionClient.connect(ticket);
try {
  const games = await client.listOwnedGames();
  const game = games.find((entry) => entry.productId === pid);
  if (!game) throw new Error(`pid ${pid} is not in the owned list`);
  const manifest = (game.latestManifest ?? "").trim().toUpperCase();
  console.log(
    `pid ${pid}  ${game.title ?? "?"}  manifest=${manifest || "(none)"}  launches=${game.launches.length}`,
  );
  if (!/^[0-9A-F]{40}$/.test(manifest)) process.exit(1);

  const credentials = await client.getDownloadCredentials(pid);
  const session = await client.openDownloads(pid, credentials);
  const [url] = await session.mintUrls([`manifests/${manifest}.manifest`]);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  const parsed = parseUbisoftManifest(
    Buffer.from(await response.arrayBuffer()),
  );

  let filesTotal = 0;
  let emptyContentSlices = 0;
  let emptyDescriptorSha = 0;
  let sampled = 0;
  for (const chunk of parsed.chunks) {
    for (const file of chunk.files) {
      if (file.isDir) continue;
      filesTotal += 1;
      const contentEmpty = file.slices.some((slice) => slice.byteLength !== 20);
      const descriptorEmpty = file.sliceList.some(
        (descriptor) => descriptor.downloadSha1.byteLength !== 20,
      );
      if (contentEmpty) emptyContentSlices += 1;
      if (file.sliceList.length > 0 && descriptorEmpty) emptyDescriptorSha += 1;
      if (sampled >= SAMPLE_FILES || file.slices.length === 0) continue;
      sampled += 1;
      console.log(
        `\nFILE ${file.name}  size=${file.size}  version=${file.version ?? "-"}\n  chunk=${chunk.id}/${chunk.type}/${chunk.language || "-"}`,
      );
      file.slices.forEach((slice, index) => {
        console.log(
          `  slices[${index}] bytes=${slice.byteLength} hex=${hexOf(slice)}`,
        );
      });
      file.sliceList.forEach((descriptor, index) => {
        console.log(
          `  desc[${index}] size=${descriptor.size} downloadSize=${descriptor.downloadSize ?? "-"} offset=${descriptor.fileOffset} downloadSha1=${hexOf(descriptor.downloadSha1)}`,
        );
      });

      if (fetchFirst && file.slices.length > 0) {
        const downloadSha =
          file.sliceList[0]?.downloadSha1.byteLength === 20
            ? Buffer.from(file.sliceList[0].downloadSha1)
                .toString("hex")
                .toUpperCase()
            : Buffer.from(file.slices[0]).toString("hex").toUpperCase();
        const cdnPath = sliceCdnPath(downloadSha);
        const [sliceUrl] = await session.mintUrls([cdnPath]);
        const sliceResponse = await fetch(sliceUrl);
        console.log(`  FETCH ${cdnPath} -> HTTP ${sliceResponse.status}`);
        if (sliceResponse.ok) {
          const raw = Buffer.from(await sliceResponse.arrayBuffer());
          const decompressed = decompressSliceBody(raw);
          console.log(
            `    raw=${raw.length}B sha1=${sha1Hex(raw)} magic=${raw.subarray(0, 4).toString("hex")}`,
          );
          console.log(
            `    body=${decompressed.length}B sha1=${sha1Hex(decompressed)}`,
          );
        }
      }
    }
  }
  console.log(
    `\nsummary: ${filesTotal} files, ${emptyContentSlices} with non-20-byte slices[] entries, ${emptyDescriptorSha} with non-20-byte descriptor downloadSha1`,
  );
} finally {
  client.destroy();
}
console.log("SLICE_SHAPE_DONE");
