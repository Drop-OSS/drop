import type { Message } from "@bufbuild/protobuf";
import type { QueryProcessor } from ".";
import type {
  DropBoundType,
  TorrentialBoundType,
} from "../../proto/torrential/proto/core_pb";

export function defineQueryProcessor<
  T extends DropBoundType,
  K extends TorrentialBoundType,
  V extends Message,
>(opts: QueryProcessor<T, K, V>) {
  // TORRENTIAL_SERVICE.queryProcessors.set(opts.queryType, opts as any);
  return opts;
}
