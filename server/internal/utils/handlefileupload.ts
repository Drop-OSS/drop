import type { EventHandlerRequest, H3Event } from "h3";
import type { Dump, Pull } from "../objects/transactional";
import { ObjectTransactionalHandler } from "../objects/transactional";

export async function handleFileUpload(
  h3: H3Event<EventHandlerRequest>,
  metadata: { [key: string]: string },
  permissions: Array<string>,
  max = -1,
): Promise<[string[], { [key: string]: string }, Pull, Dump] | undefined> {
  const formData = await readMultipartFormData(h3);
  if (!formData) return undefined;
  const transactionalHandler = new ObjectTransactionalHandler();
  const [add, pull, dump] = transactionalHandler.new(metadata, permissions);
  const options: { [key: string]: string } = {};
  const ids = [];

  for (const entry of formData) {
    if (entry.filename) {
      if (max > 0 && ids.length >= max) continue;

      // Add file to transaction handler so we can void it later if we error out
      ids.push(add(entry.data));
      continue;
    }
    if (!entry.name) continue;

    options[entry.name] = entry.data.toString("utf-8");
  }

  return [ids, options, pull, dump];
}
