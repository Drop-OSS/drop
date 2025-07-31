import { FsObjectBackend } from "./fsBackend";
import { ObjectHandler } from "./objectHandler";

export const objectHandler = new ObjectHandler(new FsObjectBackend());
export default objectHandler;
