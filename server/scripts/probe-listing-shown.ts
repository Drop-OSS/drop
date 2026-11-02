/**
 * Dev probe: show exactly which rows the tightened library listing keeps.
 */
import { openSecret } from "../server/utils/depot/credential-crypto";
import { UbisoftAcquisitionClient } from "../server/utils/ubisoft/demux/acquisition";

const ticket = openSecret(process.env.UBI_TICKET ?? null);
if (!ticket) throw new Error("UBI_TICKET (sealed value) required");
const client = await UbisoftAcquisitionClient.connect(ticket);
const games = await client.listOwnedGames();
const manifestSpaces = new Set(
  games
    .filter((g) => g.owned && g.latestManifest && g.spaceId)
    .map((g) => g.spaceId!.toLowerCase()),
);
const shown = games.filter(
  (g) =>
    g.owned &&
    !(
      !g.latestManifest &&
      g.spaceId &&
      manifestSpaces.has(g.spaceId.toLowerCase())
    ),
);
console.log(
  `total demux rows: ${games.length}  shown by listing: ${shown.length}`,
);
for (const g of shown)
  console.log(
    `  ${g.productId}  ${g.title ?? "?"}  manifest=${g.latestManifest ? "y" : "n"}  exes=${g.launches.length}`,
  );
client.destroy();
