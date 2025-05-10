import { MetadataSource } from "~/prisma/client";
import type { MetadataProvider } from ".";
import type {
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchCompanyMetadataParams,
  CompanyMetadata,
} from "./types";
import * as jdenticon from "jdenticon";

export class ManualMetadataProvider implements MetadataProvider {
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
  async fetchCompany(
    _params: _FetchCompanyMetadataParams,
  ): Promise<CompanyMetadata> {
    throw new Error("Method not implemented.");
  }
}
