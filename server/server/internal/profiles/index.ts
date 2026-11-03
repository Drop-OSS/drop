import { randomUUID } from "node:crypto";
import { createError } from "h3";
import * as jdenticon from "jdenticon";
import type { ProfileModel } from "~/prisma/client/models";
import { logger } from "../logging";
import objectHandler from "../objects";
import prisma from "../db/database";

/**
 * Profiles: players within one account. Every user has at least one (the
 * default, named "Player"); play stats and cloud saves are attributed to a
 * profile, never to the raw user. The migration
 * (20261104000000_add_profiles) backfills one per existing user, and
 * `defaultProfile` lazily recreates it for anything that predates the
 * convention, so no caller ever has to handle "no profile".
 */

export type ProfileDto = {
  id: string;
  name: string;
  isDefault: boolean;
  color: string;
  avatarObjectId: string | null;
  createdAt: string;
};

export function toProfileDto(profile: ProfileModel): ProfileDto {
  return {
    id: profile.id,
    name: profile.name,
    isDefault: profile.isDefault,
    color: profile.color,
    avatarObjectId: profile.avatarObjectId,
    createdAt: profile.createdAt.toISOString(),
  };
}

const NAME_LIMIT = 64;

/**
 * The design-system player colours: key -> { hex, hue }. The keys and hexes
 * are the same six the desktop accent picker uses (composables/theme.ts, the
 * 600-step of each ramp), so a player's colour reads identically wherever it
 * is drawn. The hue drives the identicon (jdenticon v3 restricts colours via
 * `hues`, not hexes).
 */
const PROFILE_COLORS: Record<string, { hex: string; hue: number }> = {
  blue: { hex: "#2563eb", hue: 221 },
  violet: { hex: "#7c3aed", hue: 262 },
  pink: { hex: "#db2777", hue: 333 },
  cyan: { hex: "#0891b2", hue: 192 },
  emerald: { hex: "#059669", hue: 161 },
  amber: { hex: "#d97706", hue: 32 },
  rose: { hex: "#e11d48", hue: 347 },
};
export const DEFAULT_COLOR = "blue";

function assertColor(raw: unknown): string {
  if (typeof raw !== "string" || !(raw in PROFILE_COLORS))
    throw createError({ statusCode: 400, statusMessage: "unknown colour" });
  return raw;
}

/**
 * Monochrome identicon PNG in the player's colour hue. The config is per
 * call (jdenticon's local config overrides the global one in its entirety),
 * so sign-up's default-palette identicons are never touched. Saturating the
 * grayscale shapes too pins every shape to the one allowed hue, and the
 * lightness spread keeps the icon legible in a single colour family.
 */
function renderAvatarPng(seed: string, color: string): Buffer {
  const { hue } = PROFILE_COLORS[color] ?? PROFILE_COLORS[DEFAULT_COLOR];
  return jdenticon.toPng(seed, 128, {
    hues: [hue],
    saturation: { color: 1, grayscale: 1 },
    lightness: { color: [0.45, 0.6], grayscale: [0.55, 0.8] },
  });
}

class ProfileManager {
  async list(userId: string): Promise<ProfileDto[]> {
    const profiles = await prisma.profile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return profiles.map(toProfileDto);
  }

  async create(
    userId: string,
    rawName: unknown,
    rawColor?: unknown,
  ): Promise<ProfileDto> {
    if (typeof rawName !== "string")
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    const name = rawName.trim().slice(0, NAME_LIMIT);
    if (!name)
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    // undefined keeps the schema default; anything else must be a known key.
    const color =
      rawColor === undefined ? DEFAULT_COLOR : assertColor(rawColor);

    // The very first profile of an account is its default, whoever asks for
    // it through the API - a user without a default would break every
    // fallback path.
    const existing = await prisma.profile.count({ where: { userId } });
    const profile = await prisma.profile.create({
      data: { userId, name, color, isDefault: existing === 0 },
    });
    const withAvatar = await this.attachAvatar(profile, color);
    return toProfileDto(withAvatar);
  }

  async rename(
    userId: string,
    profileId: string,
    rawName: unknown,
  ): Promise<ProfileDto> {
    if (typeof rawName !== "string")
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    const name = rawName.trim().slice(0, NAME_LIMIT);
    if (!name)
      throw createError({ statusCode: 400, statusMessage: "name is required" });

    const [updated] = await prisma.profile.updateManyAndReturn({
      where: { id: profileId, userId },
      data: { name },
    });
    if (!updated)
      throw createError({
        statusCode: 404,
        statusMessage: "Profile not found",
      });
    return toProfileDto(updated);
  }

  /**
   * Rename and recolour in one call (the PATCH route's shape). The avatar is
   * only regenerated when the colour actually moved; a rename never touches
   * it, matching its id-seeded, name-independent shape.
   */
  async update(
    userId: string,
    profileId: string,
    rawName: unknown,
    rawColor?: unknown,
  ): Promise<ProfileDto> {
    if (typeof rawName !== "string")
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    const name = rawName.trim().slice(0, NAME_LIMIT);
    if (!name)
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    const color = rawColor === undefined ? undefined : assertColor(rawColor);

    const existing = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });
    if (!existing)
      throw createError({
        statusCode: 404,
        statusMessage: "Profile not found",
      });

    const [updated] = await prisma.profile.updateManyAndReturn({
      where: { id: profileId },
      data: { name, ...(color !== undefined ? { color } : {}) },
    });
    if (!updated)
      throw createError({
        statusCode: 404,
        statusMessage: "Profile not found",
      });
    if (color === undefined || color === existing.color)
      return toProfileDto(updated);
    const withAvatar = await this.attachAvatar(updated, color);
    return toProfileDto(withAvatar);
  }

  /**
   * Give a player a new colour. The avatar is regenerated in the same call
   * (its shape is seeded by the profile id, so only the colour changes); the
   * superseded avatar object is left behind - the object store is
   * content-addressed and content-hash-deduped, and housekeeping of stale
   * per-player icons is not worth a GC pass in v1.
   */
  async setColor(
    userId: string,
    profileId: string,
    rawColor: unknown,
  ): Promise<ProfileDto> {
    const color = assertColor(rawColor);
    const [updated] = await prisma.profile.updateManyAndReturn({
      where: { id: profileId, userId },
      data: { color },
    });
    if (!updated)
      throw createError({
        statusCode: 404,
        statusMessage: "Profile not found",
      });
    const withAvatar = await this.attachAvatar(updated, color);
    return toProfileDto(withAvatar);
  }

  /**
   * Store `hex`-coloured avatar for `profile` and return the row pointing at
   * it (or the row unchanged if object storage failed - a player without an
   * avatar is a cosmetic loss, not a failed creation).
   */
  private async attachAvatar(
    profile: ProfileModel,
    color: string,
  ): Promise<ProfileModel> {
    try {
      const avatarId = randomUUID();
      await objectHandler.createFromSource(
        avatarId,
        async () => renderAvatarPng(profile.id, color),
        {},
        [`internal:read`, `${profile.userId}:read`],
      );
      const [updated] = await prisma.profile.updateManyAndReturn({
        where: { id: profile.id },
        data: { avatarObjectId: avatarId },
      });
      return updated ?? profile;
    } catch (e) {
      logger.warn(`profile ${profile.id} avatar generation failed: ${e}`);
      return profile;
    }
  }

  /**
   * The user's default profile, self-healing: an account with no default row
   * (created before this feature, or before this fork's signup backfill)
   * gets one named "Player" here and now.
   */
  async defaultProfile(userId: string): Promise<ProfileModel> {
    const found = await prisma.profile.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (found) {
      if (!found.isDefault) {
        // Oldest profile standing but marked non-default (a renamed default
        // is impossible; this only happens if data was edited): promote it.
        const [promoted] = await prisma.profile.updateManyAndReturn({
          where: { id: found.id },
          data: { isDefault: true },
        });
        return promoted ?? found;
      }
      return found;
    }
    const created = await prisma.profile.create({
      data: { userId, name: "Player", isDefault: true },
    });
    return this.attachAvatar(created, created.color);
  }

  /** Assert a client-supplied profile id belongs to this user. */
  async assertOwned(userId: string, profileId: string): Promise<ProfileModel> {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });
    if (!profile)
      throw createError({
        statusCode: 404,
        statusMessage: "Profile not found",
      });
    return profile;
  }
}

export const profileManager = new ProfileManager();
export default profileManager;
