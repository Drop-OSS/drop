import { MetadataHandler } from "./internal/metadata";
import { SessionHandler } from "./internal/session";

export * from "h3";
declare module "h3" {
    interface H3EventContext {
        session: SessionHandler;
        metadataHandler: MetadataHandler;
    }
}
