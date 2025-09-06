/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EventHandlerRequest, H3Event } from "h3";
import type { Dump, Pull, Register } from "../objects/transactional";
import { ObjectTransactionalHandler } from "../objects/transactional";

type RecursiveType =
  | { [key: string]: RecursiveType }
  | string
  | number
  | Array<RecursiveType>;

export async function handleFileUpload(
  h3: H3Event<EventHandlerRequest>,
  metadata: { [key: string]: string },
  permissions: Array<string>,
  max = -1,
): Promise<
  [string[], { [key: string]: RecursiveType }, Pull, Dump, Register] | undefined
> {
  const formData = await readMultipartFormData(h3);
  if (!formData) return undefined;
  const transactionalHandler = new ObjectTransactionalHandler();
  const [add, pull, dump] = transactionalHandler.new(metadata, permissions);
  const options: any = {};
  const ids = [];

  for (const entry of formData) {
    if (entry.filename) {
      if (max > 0 && ids.length >= max) continue;

      // Add file to transaction handler so we can void it later if we error out
      ids.push(add(entry.data));
      continue;
    }
    if (!entry.name) continue;

    const path = entry.name.split(".");
    let v = options;
    for (const pathPart of path.slice(0, -1)) {
      (v as any)[pathPart] ??= {};
      v = (v as any)[pathPart];
    }

    (v as any)[path.at(-1)!] = entry.data.toString("utf-8");
  }

  return [ids, options, pull, dump, add];
}
