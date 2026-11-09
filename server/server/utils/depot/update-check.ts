/**
 * Node-side update checking: does an entitled build differ from the newest
 * build we imported?
 *
 * This is the freshness half of the provider ownership split: GOG and
 * Ubisoft releases are the node's to keep current - the depot pulls from
 * the provider itself and re-publishes, and players install the depot copy
 * (which needs no storefront to play). EA and Rockstar are the exception -
 * their players keep games current with the launcher and import, so those
 * providers have no node-side checker.
 *
 * The comparison is by build identity, not content: GOG names builds
 * (`versionName`, falling back to `buildId`), Ubisoft names deploys by the
 * manifest SHA-1. Both already land as the imported version's `versionPath`
 * and every acquisition is idempotent per name, so asking the provider "what
 * is the newest build?" and comparing strings is the whole check. The pure
 * helpers below are what the routes consult; the network calls and task
 * queueing are theirs.
 */

/** One build list entry, narrowed to what the pick needs. */
export type BuildCandidate = {
  buildId: string;
  branch?: string | null;
  versionName?: string;
};

/** One game we imported for a provider, with its newest imported version. */
export type ImportedRow = {
  productId: string;
  gameId: string;
  title: string;
  /** The newest imported version's name, or null when the row has none. */
  latestVersion: string | null;
};

/** The minimal Prisma surface the scan needs, so tests can stub it. */
export interface ScanDb {
  game: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<{ id: string; mName: string; metadataId: string }[]>;
  };
  gameVersion: {
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy: Record<string, string>;
      select: Record<string, boolean>;
    }) => Promise<{ versionPath: string } | null>;
  };
}

/**
 * Whether `latest` names a build we do not already hold as `current`.
 *
 * Deliberately not a version comparison: these identifiers are not always
 * comparable (Ubisoft's is a hex SHA-1; GOG's is free text a publisher
 * chose), and the providers are the only authority on which build is newer -
 * both APIs answer with the newest first. So "different and present" is the
 * update signal, and a re-pull of an unchanged game costs one idempotent
 * task that imports nothing.
 */
export function isNewerBuild(
  current: string | null,
  latest: string | null | undefined,
): boolean {
  const have = (current ?? "").trim().toLowerCase();
  const wanted = (latest ?? "").trim().toLowerCase();
  if (!wanted) return false;
  return have !== wanted;
}

/**
 * The build an acquisition would choose: the newest on a stable branch
 * (Master or unbracketed), matching the GOG streamer's own pick rule so the
 * check never reports an update the acquisition would not land.
 */
export function pickLatestGogBuild(builds: BuildCandidate[]): string | null {
  const stable = builds.filter((b) => !b.branch || b.branch === "Master");
  const chosen = stable[0] ?? builds[0];
  if (!chosen) return null;
  return chosen.versionName?.trim() || chosen.buildId?.trim() || null;
}

/**
 * Every game the node imported under `<provider>-<productId>` metadata,
 * with the version name of its newest import. Game rows created by the
 * acquisition pipeline always carry this key, which is why no extra table
 * is needed to know what the node owns and how current it is.
 */
export async function scanImportedByProvider(
  db: ScanDb,
  provider: "gog" | "ubi",
): Promise<ImportedRow[]> {
  const games = await db.game.findMany({
    where: {
      metadataSource: "Manual",
      metadataId: { startsWith: `${provider}-` },
    },
    select: { id: true, mName: true, metadataId: true },
  });
  const rows: ImportedRow[] = [];
  for (const game of games) {
    // A newest-version query per game, not one join: the pipeline itself
    // queries this way, and an imported library is dozens of games, not
    // thousands.
    const newest = await db.gameVersion.findFirst({
      where: { gameId: game.id },
      // versionIndex, not the row key: it is the pipeline's newest-first
      // counter (GameVersion has no scalar id at all), the same sort every
      // other "latest version" query in the server uses.
      orderBy: { versionIndex: "desc" },
      select: { versionPath: true },
    });
    rows.push({
      productId: game.metadataId.slice(provider.length + 1),
      gameId: game.id,
      title: game.mName,
      latestVersion: newest?.versionPath ?? null,
    });
  }
  return rows;
}
