import { http, HttpResponse, type HttpHandler } from "msw";

// ---------------------------------------------------------------------------
// IGDB (Twitch OAuth2 + IGDB API v4)
// ---------------------------------------------------------------------------

export const DEFAULT_IGDB_TOKEN_RESPONSE = {
  access_token: "igdb-mock-token",
  expires_in: 3600,
  token_type: "bearer",
};

export const DEFAULT_IGDB_GAME_SEARCH_RESPONSE: unknown[] = [
  {
    id: 1,
    name: "Mock Game",
    slug: "mock-game",
    summary: "A mock game for testing.",
    first_release_date: 1700000000,
    genres: [{ id: 1, name: "Action" }],
    cover: { id: 100, image_id: "co1234" },
    artworks: [{ id: 200, image_id: "ar5678" }],
    involved_companies: [
      {
        id: 300,
        company: { id: 400, name: "Mock Dev" },
        developer: true,
        publisher: true,
      },
    ],
    screenshots: [{ id: 500, image_id: "ss9012" }],
    rating: 85.0,
    total_rating: 85.0,
  },
];

/**
 * Create MSW handlers for IGDB provider endpoints.
 *
 * Covers:
 * - `https://id.twitch.tv/oauth2/token` — Twitch OAuth (used by IGDBProvider.authWithTwitch)
 * - `https://api.igdb.com/v4/{resource}` — IGDB API v4
 * - `https://images.igdb.com/igdb/image/upload/{size}/{imageId}.jpg` — Image CDN
 */
export function igdbHandlers(overrides?: {
  token?: Partial<typeof DEFAULT_IGDB_TOKEN_RESPONSE>;
  search?: unknown[];
}): HttpHandler[] {
  const token = { ...DEFAULT_IGDB_TOKEN_RESPONSE, ...overrides?.token };
  const searchResponse = overrides?.search ?? DEFAULT_IGDB_GAME_SEARCH_RESPONSE;

  return [
    // Twitch OAuth token endpoint (IGDB auth)
    http.post("https://id.twitch.tv/oauth2/token", () =>
      HttpResponse.json(token),
    ),

    // IGDB API v4 — game search & fetch
    http.post("https://api.igdb.com/v4/games", () =>
      HttpResponse.json(searchResponse),
    ),

    // IGDB API v4 — genres
    http.post("https://api.igdb.com/v4/genres", () =>
      HttpResponse.json(
        (
          searchResponse as Array<{
            genres?: Array<{ id: number; name: string }>;
          }>
        )
          .flatMap((g) => g.genres ?? [])
          .filter((g, i, a) => a.findIndex((x) => x.id === g.id) === i),
      ),
    ),

    // IGDB API v4 — involved companies
    http.post("https://api.igdb.com/v4/involved_companies", () =>
      HttpResponse.json(
        (searchResponse as Array<{ involved_companies?: unknown[] }>).flatMap(
          (g) => g.involved_companies ?? [],
        ),
      ),
    ),

    // IGDB image CDN
    http.get(
      "https://images.igdb.com/igdb/image/upload/:size/:imageId.jpg",
      () =>
        HttpResponse.arrayBuffer(new ArrayBuffer(0), {
          headers: { "Content-Type": "image/jpeg" },
        }),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Steam (SteamCommunity search, Store API, CDN)
// ---------------------------------------------------------------------------

export const DEFAULT_STEAM_SEARCH_RESPONSE: Array<{
  appid: string;
  name: string;
  icon: string;
  logo: string;
}> = [
  {
    appid: "12345",
    name: "Mock Steam Game",
    icon: "mock_icon.jpg",
    logo: "mock_logo.jpg",
  },
];

export const DEFAULT_STEAM_STORE_DETAILS_RESPONSE = {
  response: {
    store_items: [
      {
        appid: "12345",
        id: 12345,
        success: 1,
        visible: true,
        name: "Mock Steam Game",
        item_type: 0,
        type: 0,
        store_url_path: "mock-steam-game",
        categories: {
          supported_player_categoryids: [],
          featured_categoryids: [],
          controller_categoryids: [],
        },
        basic_info: {
          short_description: "A mock Steam game for testing.",
          publishers: [{ name: "Mock Publisher", creator_clan_account_id: 1 }],
          developers: [{ name: "Mock Developer", creator_clan_account_id: 2 }],
          capsule_headline: "Mock Headline",
        },
        release: { steam_release_date: 1700000000 },
        best_purchase_option: {
          packageid: 999,
          purchase_option_name: "default",
          final_price_in_cents: "1999",
          formatted_final_price: "$19.99",
          usert_can_purchase_as_gift: true,
          hide_discount_pct_for_compliance: false,
          included_game_count: 1,
        },
      },
    ],
  },
};

/**
 * Create MSW handlers for Steam provider endpoints.
 *
 * Covers:
 * - `https://steamcommunity.com/actions/SearchApps/{query}` — search
 * - `https://store.steampowered.com/api/appdetails` — store details
 * - `https://store.steampowered.com/app/{id}` — game page HTML
 * - `https://store.steampowered.com/developer/{name}` — developer page
 * - `https://store.steampowered.com/publisher/{name}` — publisher page
 * - `https://cdn.fastly.steamstatic.com/` — image CDN
 */
export function steamHandlers(overrides?: {
  search?: unknown[];
  details?: unknown;
}): HttpHandler[] {
  const searchResponse = overrides?.search ?? DEFAULT_STEAM_SEARCH_RESPONSE;

  return [
    // Steam community search
    http.get("https://steamcommunity.com/actions/SearchApps/:query", () =>
      HttpResponse.json(searchResponse),
    ),

    // Steam store appdetails API
    http.get("https://store.steampowered.com/api/appdetails", ({ request }) => {
      const url = new URL(request.url);
      const appids = url.searchParams.get("appids");
      if (appids) {
        return HttpResponse.json({
          [appids]: {
            success: true,
            data: {
              type: "game",
              name: "Mock Steam Game",
              steam_appid: Number(appids),
              required_age: 0,
              is_free: false,
              detailed_description: "A mock game.",
              about_the_game: "A mock game for testing.",
              short_description: "A mock Steam game for testing.",
              supported_languages: "English",
              header_image:
                "https://cdn.fastly.steamstatic.com/steam/apps/12345/header.jpg",
              capsule_image:
                "https://cdn.fastly.steamstatic.com/steam/apps/12345/capsule.jpg",
              capsule_imagev5:
                "https://cdn.fastly.steamstatic.com/steam/apps/12345/capsule_184x69.jpg",
              categories: [{ id: 1, description: "Single-player" }],
              genres: [{ id: "1", description: "Action" }],
              publishers: ["Mock Publisher"],
              developers: ["Mock Developer"],
              release_date: { coming_soon: false, date: "Jan 1, 2024" },
              metacritic: {
                score: 85,
                url: "https://www.metacritic.com/game/pc/mock-game",
              },
            },
          },
        });
      }
      return HttpResponse.json({});
    }),

    // Steam store game page (HTML extraction)
    http.get("https://store.steampowered.com/app/:id/:slug?", ({ params }) =>
      HttpResponse.html(`<!DOCTYPE html>
<html><head>
<meta property="og:title" content="Mock Steam Game">
<meta property="og:description" content="A mock game for testing.">
<meta property="og:image" content="https://cdn.fastly.steamstatic.com/steam/apps/${params.id}/header.jpg">
</head><body></body></html>`),
    ),

    // Steam developer/publisher page
    http.get("https://store.steampowered.com/developer/:name", () =>
      HttpResponse.html(`<!DOCTYPE html>
<html><head><title>Mock Developer on Steam</title></head>
<body><a class="curator_url" href="https://steamcommunity.com/linkfilter/?url=https://mockdev.example.com"></a></body></html>`),
    ),
    http.get("https://store.steampowered.com/publisher/:name", () =>
      HttpResponse.html(`<!DOCTYPE html>
<html><head><title>Mock Publisher on Steam</title></head>
<body></body></html>`),
    ),

    // Steam CDN images
    http.get("https://cdn.fastly.steamstatic.com/steam/:path*", () =>
      HttpResponse.arrayBuffer(new ArrayBuffer(0), {
        headers: { "Content-Type": "image/jpeg" },
      }),
    ),
    http.get(
      "https://cdn.fastly.steamstatic.com/steamcommunity/public/images/:path*",
      () =>
        HttpResponse.arrayBuffer(new ArrayBuffer(0), {
          headers: { "Content-Type": "image/jpeg" },
        }),
    ),
  ];
}

// ---------------------------------------------------------------------------
// GiantBomb (giantbomb.com/api)
// ---------------------------------------------------------------------------

export const DEFAULT_GIANTBOMB_SEARCH_RESPONSE = {
  results: [
    {
      guid: "mock-gb-123",
      name: "Mock GiantBomb Game",
      deck: "A mock game from GiantBomb.",
      image: { icon_url: "https://www.giantbomb.com/api/image/icon.png" },
      original_release_date: "2024-01-01",
      expected_release_year: null,
    },
  ],
};

/**
 * Create MSW handlers for GiantBomb provider endpoints.
 */
export function giantbombHandlers(overrides?: {
  search?: unknown;
}): HttpHandler[] {
  const searchResponse = overrides?.search ?? DEFAULT_GIANTBOMB_SEARCH_RESPONSE;

  return [
    http.get(
      "https://www.giantbomb.com/api/:resource/:id?",
      ({ request, params }) => {
        const url = new URL(request.url);
        const format = url.searchParams.get("format") ?? "json";
        const resource = params.resource as string;

        if (resource === "search") {
          return HttpResponse.json({
            format,
            results: searchResponse,
          });
        }

        // Generic game/company/review endpoints
        return HttpResponse.json({
          format,
          results: params.id
            ? (searchResponse as { results: unknown[] }).results[0]
            : searchResponse,
        });
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// PCGamingWiki (pcgamingwiki.com)
// ---------------------------------------------------------------------------

export const DEFAULT_PCGW_SEARCH_RESPONSE = {
  query: {
    results: [
      {
        pageid: 1234,
        title: "Mock Game",
        description: "A mock game from PCGamingWiki.",
      },
    ],
  },
};

/**
 * Create MSW handlers for PCGamingWiki provider endpoints.
 */
export function pcgamingwikiHandlers(overrides?: {
  search?: unknown;
}): HttpHandler[] {
  const searchResponse = overrides?.search ?? DEFAULT_PCGW_SEARCH_RESPONSE;

  return [
    http.get("https://www.pcgamingwiki.com/w/api.php", () =>
      HttpResponse.json(searchResponse),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Combined metadata handlers
// ---------------------------------------------------------------------------

/**
 * Creates mock HTTP handlers for all supported metadata providers.
 *
 * @param overrides - Optional provider-specific response overrides
 * @returns The combined metadata provider mock handlers
 */
export function allMetadataHandlers(overrides?: {
  igdb?: NonNullable<Parameters<typeof igdbHandlers>[0]>;
  steam?: NonNullable<Parameters<typeof steamHandlers>[0]>;
  giantbomb?: NonNullable<Parameters<typeof giantbombHandlers>[0]>;
  pcgamingwiki?: NonNullable<Parameters<typeof pcgamingwikiHandlers>[0]>;
}): HttpHandler[] {
  return [
    ...igdbHandlers(overrides?.igdb),
    ...steamHandlers(overrides?.steam),
    ...giantbombHandlers(overrides?.giantbomb),
    ...pcgamingwikiHandlers(overrides?.pcgamingwiki),
  ];
}
