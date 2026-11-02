/**
 * Dev probe: print the start_game-relevant slice of each owned game's
 * install configuration so the launch/title scanner can be checked against
 * real per-generation structures.
 */
import { openSecret } from "../server/utils/depot/credential-crypto";
import { UbisoftAcquisitionClient } from "../server/utils/ubisoft/demux/acquisition";

const ticket = openSecret(process.env.UBI_TICKET ?? null);
if (!ticket) throw new Error("UBI_TICKET (sealed value) required");
const wanted = (process.env.UBI_PIDS ?? "80,54,13")
  .split(",")
  .map((p) => Number(p));
const client = await UbisoftAcquisitionClient.connect(ticket);
try {
  const games = await client.listOwnedGames();
  for (const game of games.filter((g) => wanted.includes(g.productId))) {
    console.log(`\n===== pid ${game.productId} (${game.title ?? "?"}) =====`);
    const config = game.configuration ?? "";
    const lines = config.split(/\r?\n/);
    const start = lines.findIndex((l) => l.trim() === "root:");
    // Name + start_game block, indented structure preserved.
    for (let i = start; i < lines.length && i < start + 12; i++)
      console.log(lines[i]);
    const sg = lines.findIndex((l) => l.trim() === "start_game:");
    if (sg >= 0) {
      console.log("  ... [start_game block]");
      for (let i = sg; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.trim() === "" ||
          /^\s*(overlay|denuvo|pc_bang|touche|uplay_|anticheat|require|launch|cloud|save|restriction|third|achievement|gamecenter|social|online_play|rpe|fusion|orbit|playtime|play_next|pre_start|third|isGameOfTheYear|vr_|win)/.test(
            line.trim(),
          )
        )
          continue;
        if (i > sg + 1 && line.trimEnd() !== "" && (line.length - line.trimStart().length <= 4) && !line.trim().endsWith(":")) break;
        console.log(line);
        if (i - sg > 60) break;
      }
    }
  }
} finally {
  client.destroy();
}
console.log("\nCONFIGS_DONE");
