import { MetadataSource } from "~/prisma/client/enums";
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
      id: crypto.randomUUID(),
      name,
      shortDescription: "Default description.",
      description: "# Default description.",
      released: new Date(),
      publishers: [],
      developers: [],
      tags: [],
      reviews: [],

      icon: iconId,
      coverId: iconId,
      bannerId: iconId,
      images: [iconId],
    };
  }
  async fetchCompany(
    _params: _FetchCompanyMetadataParams,
  ): Promise<CompanyMetadata | undefined> {
    return undefined;
  }
}
