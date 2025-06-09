/*
The purpose of this class is to hold references to remote objects (like images) until they're actually needed
This is used as a utility in metadata handling, so we only fetch the objects if we're actually creating a database record.
*/
import type { Readable } from "stream";
import { randomUUID } from "node:crypto";
import objectHandler from ".";
import type { TaskRunContext } from "../tasks";

export type TransactionDataType = string | Readable | Buffer;
type TransactionTable = Map<string, TransactionDataType>; // ID to data
type GlobalTransactionRecord = Map<string, TransactionTable>; // Transaction ID to table

export type Register = (url: TransactionDataType) => string;
export type Pull = () => Promise<void>;
export type Dump = () => void;

export class ObjectTransactionalHandler {
  private record: GlobalTransactionRecord = new Map();

  new(
    metadata: { [key: string]: string },
    permissions: Array<string>,
    context?: TaskRunContext,
  ): [Register, Pull, Dump] {
    const transactionId = randomUUID();

    this.record.set(transactionId, new Map());

    const register = (data: TransactionDataType) => {
      const objectId = randomUUID();
      this.record.get(transactionId)?.set(objectId, data);

      return objectId;
    };

    const pull = async () => {
      const transaction = this.record.get(transactionId);
      if (!transaction) return;

      let progress = 0;
      const increment = (100 / transaction.size);

      for (const [id, data] of transaction) {
        if (typeof data === "string") {
          context?.log(`Importing object from "${data}"`);
        } else {
          context?.log(`Importing raw object...`);
        }
        await objectHandler.createFromSource(
          id,
          () => {
            if (typeof data === "string") {
              return $fetch<Readable>(data, { responseType: "stream" });
            }
            return (async () => data)();
          },
          metadata,
          permissions,
        );
        progress += increment;
        context?.progress(progress);
      }
    };

    const dump = () => {
      this.record.delete(transactionId);
    };

    return [register, pull, dump];
  }
}
