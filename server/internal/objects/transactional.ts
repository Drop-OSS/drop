/*
The purpose of this class is to hold references to remote objects (like images) until they're actually needed
This is used as a utility in metadata handling, so we only fetch the objects if we're actually creating a database record.
*/
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { objectHandler } from "~/server/plugins/objects";

export type TransactionDataType = string | Readable | Buffer;
type TransactionTable = { [key: string]: TransactionDataType }; // ID to data
type GlobalTransactionRecord = { [key: string]: TransactionTable }; // Transaction ID to table

export type Register = (url: TransactionDataType) => string;
export type Pull = () => Promise<void>;
export type Dump = () => void;

export class ObjectTransactionalHandler {
  private record: GlobalTransactionRecord = {};

  new(
    metadata: { [key: string]: string },
    permissions: Array<string>
  ): [Register, Pull, Dump] {
    const transactionId = uuidv4();

    this.record[transactionId] ??= {};

    const register = (data: TransactionDataType) => {
      const objectId = uuidv4();
      this.record[transactionId][objectId] = data;

      return objectId;
    };

    const pull = async () => {
      for (const [id, data] of Object.entries(this.record[transactionId])) {
        await objectHandler.createFromSource(
          id,
          () => {
            if (typeof data === "string") {
              return $fetch<Readable>(data, { responseType: "stream" });
            }
            return (async () => data)();
          },
          metadata,
          permissions
        );
      }
    };

    const dump = () => {
      delete this.record[transactionId];
    };

    return [register, pull, dump];
  }
}
