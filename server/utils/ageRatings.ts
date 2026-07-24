import { AgeRatingOrganization } from "~/prisma/client/enums";

/**
 * This file will live as the known ratings that come from various sources. Each source reports a bit differently, the goal
 * will be to normalize to these ratings. Admins of course can override and set a separate rating if needed.
 *
 * These will change, but historically very infrequently.
 */

export const ESRBRating = {
  EC: "EC",
  E: "E",
  E10: "E10",
  T: "T",
  M: "M",
  AO: "AO",
} as const;

export const PEGIRating = {
  "3": "3",
  "7": "7",
  "12": "12",
  "16": "16",
  "18": "18",
} as const;

export const CEROrating = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  Z: "Z",
} as const;

export const USKRating = {
  "0": "0",
  "6": "6",
  "12": "12",
  "16": "16",
  "18": "18",
} as const;

export const GRACRating = {
  ALL: "ALL",
  "12": "12",
  "15": "15",
  "18": "18",
} as const;

export const ClassIndRating = {
  L: "L",
  "10": "10",
  "12": "12",
  "14": "14",
  "16": "16",
  "18": "18",
} as const;

export const ACBRating = {
  G: "G",
  PG: "PG",
  M: "M",
  MA15: "MA15",
  R18: "R18",
  RC: "RC",
} as const;

export const RATINGS_FOR_ORGANIZATION = {
  [AgeRatingOrganization.ESRB]: ESRBRating,
  [AgeRatingOrganization.PEGI]: PEGIRating,
  [AgeRatingOrganization.CERO]: CEROrating,
  [AgeRatingOrganization.USK]: USKRating,
  [AgeRatingOrganization.GRAC]: GRACRating,
  [AgeRatingOrganization.ClassInd]: ClassIndRating,
  [AgeRatingOrganization.ACB]: ACBRating,
} as const satisfies Record<AgeRatingOrganization, Record<string, string>>;

export function getAvailableRatings(org: AgeRatingOrganization): string[] {
  return Object.values(RATINGS_FOR_ORGANIZATION[org]);
}
