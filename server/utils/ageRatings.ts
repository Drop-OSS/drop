import { AgeRatingOrganization } from "~/prisma/client/enums";

/**
 * This file will live as the known ratings that come from various sources. Each source reports a bit differently, the goal
 * will be to normalize to these ratings. Admins of course can override and set a separate rating if needed.
 *
 * These will change, but historically very infrequently.
 *
 * Each rating has a `value` (the string stored in the database) and an `age` (the minimum age for that rating).
 */

interface RatingDef {
  readonly value: string;
  readonly age: number;
}

export const ESRBRating = {
  EC: { value: "EC", age: 3 },
  E: { value: "E", age: 6 },
  E10: { value: "E10", age: 10 },
  T: { value: "T", age: 13 },
  M: { value: "M", age: 17 },
  AO: { value: "AO", age: 18 },
} as const;

export const PEGIRating = {
  "3": { value: "3", age: 3 },
  "7": { value: "7", age: 7 },
  "12": { value: "12", age: 12 },
  "16": { value: "16", age: 16 },
  "18": { value: "18", age: 18 },
} as const;

export const CEROrating = {
  A: { value: "A", age: 0 },
  B: { value: "B", age: 12 },
  C: { value: "C", age: 15 },
  D: { value: "D", age: 17 },
  Z: { value: "Z", age: 18 },
} as const;

export const USKRating = {
  "0": { value: "0", age: 0 },
  "6": { value: "6", age: 6 },
  "12": { value: "12", age: 12 },
  "16": { value: "16", age: 16 },
  "18": { value: "18", age: 18 },
} as const;

export const GRACRating = {
  ALL: { value: "ALL", age: 0 },
  "12": { value: "12", age: 12 },
  "15": { value: "15", age: 15 },
  "18": { value: "18", age: 18 },
} as const;

export const ClassIndRating = {
  L: { value: "L", age: 0 },
  "10": { value: "10", age: 10 },
  "12": { value: "12", age: 12 },
  "14": { value: "14", age: 14 },
  "16": { value: "16", age: 16 },
  "18": { value: "18", age: 18 },
} as const;

export const ACBRating = {
  G: { value: "G", age: 0 },
  PG: { value: "PG", age: 8 },
  M: { value: "M", age: 15 },
  MA15: { value: "MA15", age: 15 },
  R18: { value: "R18", age: 18 },
  RC: { value: "RC", age: 18 },
} as const;

export const RATINGS_FOR_ORGANIZATION = {
  [AgeRatingOrganization.ESRB]: ESRBRating,
  [AgeRatingOrganization.PEGI]: PEGIRating,
  [AgeRatingOrganization.CERO]: CEROrating,
  [AgeRatingOrganization.USK]: USKRating,
  [AgeRatingOrganization.GRAC]: GRACRating,
  [AgeRatingOrganization.ClassInd]: ClassIndRating,
  [AgeRatingOrganization.ACB]: ACBRating,
} as const satisfies Record<
  AgeRatingOrganization,
  Record<string, RatingDef>
>;

export function getAvailableRatings(org: AgeRatingOrganization): string[] {
  return Object.values(RATINGS_FOR_ORGANIZATION[org]).map((r) => r.value);
}

/**
 * Given a maximum allowed age, returns all org:rating pairs that exceed it (should be banned).
 */
export function getBannedRatingsForMaxAge(
  maxAge: number,
): Array<{ organization: AgeRatingOrganization; rating: string }> {
  const banned: Array<{ organization: AgeRatingOrganization; rating: string }> =
    [];
  for (const org of Object.values(AgeRatingOrganization)) {
    const ratings = RATINGS_FOR_ORGANIZATION[org];
    for (const def of Object.values(ratings)) {
      if (def.age > maxAge) {
        banned.push({ organization: org, rating: def.value });
      }
    }
  }
  return banned;
}

/**
 * Given a set of banned ratings, infer what max age slider position would produce them.
 * Returns null if the set doesn't match any clean slider threshold (manual overrides).
 */
export function inferMaxAgeFromBannedRatings(
  banned: Array<{ organization: string; rating: string }>,
): number | null {
  if (banned.length === 0) return 18;

  // Try each possible age and check if the banned set matches exactly
  const possibleAges = new Set<number>();
  for (const orgRatings of Object.values(RATINGS_FOR_ORGANIZATION)) {
    for (const def of Object.values(orgRatings)) {
      possibleAges.add(def.age);
    }
  }

  const bannedSet = new Set(banned.map((b) => `${b.organization}:${b.rating}`));

  for (const age of Array.from(possibleAges).sort((a, b) => b - a)) {
    const expected = getBannedRatingsForMaxAge(age);
    const expectedSet = new Set(
      expected.map((e) => `${e.organization}:${e.rating}`),
    );
    if (
      expectedSet.size === bannedSet.size &&
      [...expectedSet].every((e) => bannedSet.has(e))
    ) {
      return age;
    }
  }

  return null;
}
