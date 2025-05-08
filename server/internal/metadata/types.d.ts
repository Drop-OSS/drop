import type { Developer, Publisher } from "~/prisma/client";
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
  publishers: Publisher[];
  developers: Developer[];

  reviewCount: number;
  reviewRating: number;

  // Created with another utility function
  icon: ObjectReference;
  bannerId: ObjectReference;
  coverId: ObjectReference;
  images: ObjectReference[];
}

export interface PublisherMetadata {
  id: string;
  name: string;
  shortDescription: string;
  description: string;

  logo: ObjectReference;
  banner: ObjectReference;
  website: string;
}

export type DeveloperMetadata = PublisherMetadata;

export interface _FetchGameMetadataParams {
  id: string;
  name: string;

  publisher: (query: string) => Promise<Publisher>;
  developer: (query: string) => Promise<Developer>;

  createObject: (data: TransactionDataType) => ObjectReference;
}

export interface _FetchPublisherMetadataParams {
  query: string;
  createObject: (data: TransactionDataType) => ObjectReference;
}

export type _FetchDeveloperMetadataParams = _FetchPublisherMetadataParams;
