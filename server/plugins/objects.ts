import { FsObjectBackend } from "../internal/objects/fsBackend";

export default defineNitroPlugin((nitro) => {
  const currentObjectHandler = new FsObjectBackend();

  // To-do insert logic surrounding deciding what object backend to use

  nitro.hooks.hook("request", (h3) => {
    h3.context.objects = currentObjectHandler;
  });
});
