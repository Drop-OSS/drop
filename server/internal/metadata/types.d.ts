import type { Company } from "~/prisma/client";
import type { TransactionDataType } from "../objects/transactional";
import type { ObjectReference } from "../objects/objectHandler";

export interface GameMetadataSearchResult {
  id: string;
  name: string;
  icon: string;
  description: string;
  year: number;
}

export interface GameMetadataSource {
  sourceId: string;
  sourceName: string;
}

export type InternalGameMetadataResult = GameMetadataSearchResult &
  GameMetadataSource;

export interface GameMetadata {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  released: Date;

  // These are created using utility functions passed to the metadata loader
  // (that then call back into the metadata provider chain)
  publishers: Company[];
  developers: Company[];

  reviewCount: number;
  reviewRating: number;

  // Created with another utility function
  icon: ObjectReference;
  bannerId: ObjectReference;
  coverId: ObjectReference;
  images: ObjectReference[];
}

export interface CompanyMetadata {
  id: string;
  name: string;
  shortDescription: string;
  description: string;

  logo: ObjectReference;
  banner: ObjectReference;
  website: string;
}

export interface _FetchGameMetadataParams {
  id: string;
  name: string;

  publisher: (query: string) => Promise<Company | undefined>;
  developer: (query: string) => Promise<Company | undefined>;

  createObject: (data: TransactionDataType) => ObjectReference;
}

export interface _FetchCompanyMetadataParams {
  query: string;
  createObject: (data: TransactionDataType) => ObjectReference;
}
