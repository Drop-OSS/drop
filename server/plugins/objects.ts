import { FsObjectBackend } from "../internal/objects/fsBackend";

// To-do insert logic surrounding deciding what object backend to use
export const GlobalObjectHandler = new FsObjectBackend();

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("request", (h3) => {
    h3.context.objects = GlobalObjectHandler;
  });
});
