import { createError, getHeader, getQuery, type H3Event } from "h3";
import type { ProfileModel } from "~/prisma/client/models";
import profileManager from ".";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The profile a request acts as: `?profile=<id>` wins, the `x-profile-id`
 * header is the fallback, and no selector means the user's default profile.
 * The identity to match against is always the route's authenticated user, so
 * a valid-but-foreign profile id is a 404, never a cross-account read.
 */
export async function getProfile(
  event: H3Event,
  userId: string,
): Promise<ProfileModel> {
  const query = getQuery(event);
  const raw =
    (typeof query.profile === "string" ? query.profile : undefined) ??
    getHeader(event, "x-profile-id");
  if (!raw) return profileManager.defaultProfile(userId);
  if (!UUID_RE.test(raw))
    throw createError({ statusCode: 400, statusMessage: "Invalid profile selector" });
  return profileManager.assertOwned(userId, raw);
}
