import type { H3Event } from "h3";
import { getQuery, createError } from "h3";
import type { HttpMethod, RouteHandler, RouteHandlerContext } from "./types";

export interface RegisteredRoute {
  method: HttpMethod;
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/** Resolves the caller identity for a dispatched plugin route. */
export type RouteAuthResolver = (
  event: H3Event,
) => Promise<{ userId?: string; userAcls?: string[] }>;

/** Strips trailing slashes without a backtracking-prone regular expression. */
function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end--;
  }
  return value.slice(0, end);
}

/** Upper bound on a plugin route pattern, limiting regex construction cost. */
const MAX_ROUTE_PATTERN_LENGTH = 512;

/** Escapes RegExp metacharacters so literal route text cannot form a pattern. */
function escapeRegExp(value: string): string {
  const specials = ".*+?^${}()|[]\\";
  let escaped = "";
  for (const char of value) {
    escaped += specials.includes(char) ? `\\${char}` : char;
  }
  return escaped;
}

/**
 * Translates one token of a plugin route pattern into regex source. Recognises
 * `:name`, `*`, and `**`; every other character is escaped so it stays literal.
 */
function routeTokenToRegexSource(
  normalized: string,
  index: number,
  paramNames: string[],
): { source: string; consumed: number } {
  const char = normalized[index];
  if (char === ":" && /[A-Za-z0-9_]/.test(normalized[index + 1] ?? "")) {
    let end = index + 1;
    while (end < normalized.length && /\w/.test(normalized[end] ?? "")) {
      end++;
    }
    paramNames.push(normalized.slice(index + 1, end));
    return { source: "([^/]+)", consumed: end - index };
  }
  if (char === "*") {
    return normalized[index + 1] === "*"
      ? { source: "(.*)", consumed: 2 }
      : { source: "([^/]+)", consumed: 1 };
  }
  return { source: escapeRegExp(char ?? ""), consumed: 1 };
}

/**
 * Translates a plugin route pattern into a literal-safe regular expression.
 * `:name`, `*` and `**` become capture groups; everything else is escaped.
 */
export function patternToRegex(pattern: string): {
  regex: RegExp;
  paramNames: string[];
} {
  if (pattern.length > MAX_ROUTE_PATTERN_LENGTH) {
    throw new Error(
      `Plugin route pattern exceeds ${MAX_ROUTE_PATTERN_LENGTH} characters`,
    );
  }
  const paramNames: string[] = [];
  const normalized = trimTrailingSlashes(
    pattern.startsWith("/") ? pattern : `/${pattern}`,
  );

  // Build the pattern token-by-token and escape every literal character, so
  // a plugin cannot inject regex metacharacters (and thus a ReDoS payload)
  // through a route pattern.
  let source = "";
  for (let index = 0; index < normalized.length; ) {
    const token = routeTokenToRegexSource(normalized, index, paramNames);
    source += token.source;
    index += token.consumed;
  }

  return {
    regex: new RegExp(`^${source || "/"}(?:/)?$`),
    paramNames,
  };
}

/** Per-plugin route table plus dispatch into the matching handler. */
export class PluginRouteTable {
  private readonly routes = new Map<string, RegisteredRoute[]>();

  /** Reserve (or reset) the route list for `pluginId`. */
  create(pluginId: string): void {
    this.routes.set(pluginId, []);
  }

  register(
    pluginId: string,
    method: HttpMethod,
    pattern: string,
    handler: RouteHandler,
  ): void {
    const { regex, paramNames } = patternToRegex(pattern);
    this.routes.get(pluginId)?.push({
      method,
      pattern,
      regex,
      paramNames,
      handler,
    });
  }

  release(pluginId: string): void {
    this.routes.delete(pluginId);
  }

  async dispatch(
    pluginId: string,
    method: string,
    rawSubPath: string,
    event: H3Event,
    resolveAuth: RouteAuthResolver,
  ): Promise<unknown> {
    const pluginRoutes = this.routes.get(pluginId) ?? [];
    const normalizedPath = rawSubPath.startsWith("/")
      ? rawSubPath
      : `/${rawSubPath}`;
    const cleanPath = normalizedPath.split("?")[0] || "/";

    let matchedRoute: RegisteredRoute | null = null;
    let matchedParams: Record<string, string> = {};

    for (const route of pluginRoutes) {
      if (route.method !== "ALL" && route.method !== method) {
        continue;
      }

      const match = route.regex.exec(cleanPath);
      if (match) {
        matchedRoute = route;
        matchedParams = {};
        route.paramNames.forEach((name, idx) => {
          matchedParams[name] = decodeURIComponent(match[idx + 1] || "");
        });
        break;
      }
    }

    if (!matchedRoute) {
      throw createError({
        statusCode: 404,
        statusMessage: `No handler found for [${method}] ${cleanPath} in plugin '${pluginId}'`,
      });
    }

    let userId: string | undefined;
    let userAcls: string[] | undefined;
    try {
      const auth = await resolveAuth(event);
      userId = auth.userId;
      userAcls = auth.userAcls;
    } catch {
      // Unauthenticated callers receive undefined userId
    }

    const context: RouteHandlerContext = {
      params: matchedParams,
      query: getQuery(event),
      userId,
      userAcls,
    };

    return await matchedRoute.handler(event, context);
  }
}
