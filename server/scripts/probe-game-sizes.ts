/**
 * Dev probe: report each owned Ubisoft title's acquirable install size
 * (required + wanted-language chunks) straight from its live manifest.
 */
import { openSecret } from "../server/utils/depot/credential-crypto";
import { getUbisoftOwnedTitles } from "../server/utils/ubisoft/client";
import { UbisoftAcquisitionClient } from "../server/utils/ubisoft/demux/acquisition";
import {
  buildUbisoftDownloadPlan,
  parseUbisoftManifest,
} from "../server/utils/ubisoft/manifest";

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB`;

const ticket = openSecret(process.env.UBI_TICKET ?? null);
if (!ticket) throw new Error("UBI_TICKET (sealed value) required");
const client = await UbisoftAcquisitionClient.connect(ticket);
try {
  const games = await client.listOwnedGames();
  const graphql = await getUbisoftOwnedTitles(ticket).catch((e) => {
    console.log("graphql failed:", String(e).slice(0, 120));
    return [];
  });
  const gqlSpaces = new Set(
    graphql.map((t) => (t.spaceId ?? "").toLowerCase()).filter(Boolean),
  );
  const demuxSpaces = new Set(
    games
      .map((g) => (g.spaceId ?? "").toLowerCase())
      .filter(Boolean) as string[],
  );
  console.log(
    `demux entries: ${games.length}  (owned=true: ${games.filter((g) => g.owned).length})`,
  );
  for (const game of games) {
    const name = game.title ?? `pid ${game.productId}`;
    console.log(
      `pid ${game.productId}  ${name}  owned=${game.owned}  space=${game.spaceId ?? "-"}  manifest=${game.latestManifest ? "yes" : "no"}`,
    );
  }
  console.log(`\ngraphql rows: ${graphql.length}`);
  for (const t of graphql) {
    const key = (t.spaceId ?? "").toLowerCase();
    if (!key || !demuxSpaces.has(key))
      console.log(`  GQL-ONLY  ${t.spaceId}  ${t.name}`);
  }
  void gqlSpaces;
  for (const game of games) {
    const name = game.title ?? `pid ${game.productId}`;
    if (!game.owned || !game.latestManifest) {
      console.log(`pid ${game.productId}  ${name}  ->  not acquirable`);
      continue;
    }
    try {
      const credentials = await client.getDownloadCredentials(game.productId);
      const session = await client.openDownloads(game.productId, credentials);
      const [url] = await session.mintUrls([
        `manifests/${game.latestManifest}.manifest`,
      ]);
      const response = await fetch(url);
      if (!response.ok) {
        console.log(
          `pid ${game.productId}  ${name}  ->  manifest HTTP ${response.status}`,
        );
        continue;
      }
      const plan = buildUbisoftDownloadPlan(
        parseUbisoftManifest(Buffer.from(await response.arrayBuffer())),
        "en-US",
      );
      console.log(
        `pid ${game.productId}  ${name}  ->  ${plan.files.length} files, ${gb(plan.totalBytes)}, ${plan.totalSlices} slices, exe: ${game.launches.map((l) => l.executable).join(", ") || "none"}`,
      );
    } catch (error) {
      console.log(
        `pid ${game.productId}  ${name}  ->  probe failed: ${String((error as { statusMessage?: string })?.statusMessage ?? (error as Error)?.message ?? error).slice(0, 120)}`,
      );
    }
  }
} finally {
  client.destroy();
}
console.log("SIZES_DONE");
