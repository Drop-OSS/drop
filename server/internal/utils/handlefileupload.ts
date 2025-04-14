import type { EventHandlerRequest, H3Event } from "h3";
import type { Dump, Pull } from "../objects/transactional";
import { ObjectTransactionalHandler } from "../objects/transactional";

export async function handleFileUpload(
  h3: H3Event<EventHandlerRequest>,
  metadata: { [key: string]: string },
  permissions: Array<string>
): Promise<[string | undefined, {[key: string]: string}, Pull, Dump] | undefined> {
  const formData = await readMultipartFormData(h3);
  if (!formData) return undefined;
  const transactionalHandler = new ObjectTransactionalHandler();
  const [add, pull, dump] = transactionalHandler.new(metadata, permissions);
  const options: { [key: string]: string } = {};
  let id;

  for (const entry of formData) {
    if (entry.filename) {
      // Only pick one file
      if (id) continue;

      // Add file to transaction handler so we can void it later if we error out
      id = add(entry.data);
      continue;
    }
    if (!entry.name) continue;

    options[entry.name] = entry.data.toString("utf-8");
  }

  return [id, options, pull, dump];
}
