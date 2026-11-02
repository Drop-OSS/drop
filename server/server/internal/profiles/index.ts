import { createError } from "h3";
import type { ProfileModel } from "~/prisma/client/models";
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
  createdAt: string;
};

export function toProfileDto(profile: ProfileModel): ProfileDto {
  return {
    id: profile.id,
    name: profile.name,
    isDefault: profile.isDefault,
    createdAt: profile.createdAt.toISOString(),
  };
}

const NAME_LIMIT = 64;

class ProfileManager {
  async list(userId: string): Promise<ProfileDto[]> {
    const profiles = await prisma.profile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return profiles.map(toProfileDto);
  }

  async create(userId: string, rawName: unknown): Promise<ProfileDto> {
    if (typeof rawName !== "string")
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    const name = rawName.trim().slice(0, NAME_LIMIT);
    if (!name)
      throw createError({ statusCode: 400, statusMessage: "name is required" });

    // The very first profile of an account is its default, whoever asks for
    // it through the API - a user without a default would break every
    // fallback path.
    const existing = await prisma.profile.count({ where: { userId } });
    const profile = await prisma.profile.create({
      data: { userId, name, isDefault: existing === 0 },
    });
    return toProfileDto(profile);
  }

  async rename(userId: string, profileId: string, rawName: unknown): Promise<ProfileDto> {
    if (typeof rawName !== "string")
      throw createError({ statusCode: 400, statusMessage: "name is required" });
    const name = rawName.trim().slice(0, NAME_LIMIT);
    if (!name)
      throw createError({ statusCode: 400, statusMessage: "name is required" });

    const existing = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });
    if (!existing)
      throw createError({ statusCode: 404, statusMessage: "Profile not found" });

    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: { name },
    });
    return toProfileDto(updated);
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
        return prisma.profile.update({
          where: { id: found.id },
          data: { isDefault: true },
        });
      }
      return found;
    }
    return prisma.profile.create({
      data: { userId, name: "Player", isDefault: true },
    });
  }

  /** Assert a client-supplied profile id belongs to this user. */
  async assertOwned(userId: string, profileId: string): Promise<ProfileModel> {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });
    if (!profile)
      throw createError({ statusCode: 404, statusMessage: "Profile not found" });
    return profile;
  }
}

export const profileManager = new ProfileManager();
export default profileManager;
