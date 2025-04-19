import { MetadataSource } from "@prisma/client";
import type { MetadataProvider } from ".";
import type {
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchPublisherMetadataParams,
  PublisherMetadata,
  _FetchDeveloperMetadataParams,
  DeveloperMetadata,
} from "./types";
import * as jdenticon from "jdenticon";

export class ManualMetadataProvider implements MetadataProvider {
  id() {
    return "manual";
  }
  name() {
    return "Manual";
  }
  source() {
    return MetadataSource.Manual;
  }
  async search(_query: string) {
    return [];
  }
  async fetchGame({
    name,
    createObject,
  }: _FetchGameMetadataParams): Promise<GameMetadata> {
    const icon = jdenticon.toPng(name, 512);
    const iconId = createObject(icon);

    return {
      id: "manual",
      name,
      shortDescription: "Default description.",
      description: "# Default description.",
      released: new Date(),
      publishers: [],
      developers: [],
      reviewCount: 0,
      reviewRating: 0,

      icon: iconId,
      coverId: iconId,
      bannerId: iconId,
      images: [iconId],
    };
  }
  async fetchPublisher(
    _params: _FetchPublisherMetadataParams,
  ): Promise<PublisherMetadata> {
    throw new Error("Method not implemented.");
  }
  async fetchDeveloper(
    _params: _FetchDeveloperMetadataParams,
  ): Promise<DeveloperMetadata> {
    throw new Error("Method not implemented.");
  }
}
