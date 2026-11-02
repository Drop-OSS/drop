import { createError, defineEventHandler, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import {
  parseLudusaviManifest,
  type LudusaviEntry,
} from "~/server/utils/saves/manifest";

type ImportBody = {
  /** A Ludusavi manifest document (the upstream manifest.yaml or any subset). */
  yaml?: string;
  /** Ludusavi title -> our Game metadataId (as written by the ingests: "ubi-5266", "gog-1711765822", ...). */
  mapping?: Record<string, string>;
};

type ImportRow = {
  ludusaviName: string;
  metadataId: string;
  gameId?: string;
  game?: string;
  status: "imported" | "skipped";
  reason?: string;
  fileCount?: number;
};

/** Follow `alias` hops to the entry that carries the paths (cycle-guarded). */
function resolveAlias(
  title: string,
  doc: Record<string, LudusaviEntry>,
): { title: string; entry: LudusaviEntry } | { error: string } {
  let current = title;
  const seen = new Set<string>();
  for (;;) {
    const entry = doc[current];
    if (!entry) return { error: `no entry named "${current}" in the document` };
    if (!entry.alias) return { title: current, entry };
    if (seen.has(current)) return { error: `alias cycle at "${current}"` };
    seen.add(current);
    current = entry.alias;
  }
}

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["settings:update"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const body = await readBody<ImportBody>(event);
  if (typeof body?.yaml !== "string" || body.yaml.trim() === "")
    throw createError({ statusCode: 400, statusMessage: "yaml is required" });
  if (
    typeof body.mapping !== "object" ||
    body.mapping === null ||
    Array.isArray(body.mapping)
  )
    throw createError({
      statusCode: 400,
      statusMessage:
        "mapping must be an object of Ludusavi title -> metadataId",
    });

  const doc = parseLudusaviManifest(body.yaml);

  const results: ImportRow[] = [];
  for (const [ludusaviName, metadataIdRaw] of Object.entries(body.mapping)) {
    const metadataId =
      typeof metadataIdRaw === "string" ? metadataIdRaw.trim() : "";
    if (metadataId === "") {
      results.push({
        ludusaviName,
        metadataId: String(metadataIdRaw ?? ""),
        status: "skipped",
        reason: "empty metadataId in mapping",
      });
      continue;
    }
    const resolved = resolveAlias(ludusaviName, doc);
    if ("error" in resolved) {
      results.push({
        ludusaviName,
        metadataId,
        status: "skipped",
        reason: resolved.error,
      });
      continue;
    }
    // metadataId alone is not a Prisma unique key (the unique is the
    // source+id pair the ingests write), so resolve by lookup and refuse
    // ambiguous hits rather than guessing.
    const games = await prisma.game.findMany({
      where: { metadataId },
      select: { id: true, mName: true },
    });
    if (games.length === 0) {
      results.push({
        ludusaviName,
        metadataId,
        status: "skipped",
        reason: "no game with that metadataId in the library",
      });
      continue;
    }
    if (games.length > 1) {
      results.push({
        ludusaviName,
        metadataId,
        status: "skipped",
        reason: `${games.length} games share this metadataId`,
      });
      continue;
    }
    const game = games[0]!;
    // JSON round-trip strips the `undefined` fields the parser leaves for
    // absent optionals; Postgres JSONB rejects them as Prisma arguments.
    const entry = JSON.parse(JSON.stringify(resolved.entry)) as never;
    await prisma.saveManifest.upsert({
      where: { gameId: game.id },
      create: {
        gameId: game.id,
        entry,
        source: "ludusavi",
        ludusaviName: resolved.title,
      },
      update: {
        entry,
        source: "ludusavi",
        ludusaviName: resolved.title,
      },
    });
    results.push({
      ludusaviName,
      metadataId,
      gameId: game.id,
      game: game.mName,
      status: "imported",
      fileCount: Object.keys(resolved.entry.files ?? {}).length,
    });
  }

  return {
    imported: results.filter((r) => r.status === "imported").length,
    results,
  };
});
