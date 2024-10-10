/*
The purpose of this class is to hold references to remote objects (like images) until they're actually needed
This is used as a utility in metadata handling, so we only fetch the objects if we're actually creating a database record.
*/
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { GlobalObjectHandler } from "~/server/plugins/objects";

type TransactionTable = { [key: string]: string }; // ID to URL
type GlobalTransactionRecord = { [key: string]: TransactionTable }; // Transaction ID to table

type Register = (url: string) => string;
type Pull = () => Promise<void>;
type Dump = () => void;

export class ObjectTransactionalHandler {
  private record: GlobalTransactionRecord = {};

  new(
    metadata: { [key: string]: string },
    permissions: Array<string>
  ): [Register, Pull, Dump] {
    const transactionId = uuidv4();

    this.record[transactionId] ??= {};

    const register = (url: string) => {
      const objectId = uuidv4();
      this.record[transactionId][objectId] = url;

      return objectId;
    };

    const pull = async () => {
      for (const [id, url] of Object.entries(this.record[transactionId])) {
        await GlobalObjectHandler.createFromSource(
          id,
          () => $fetch<Readable>(url, { responseType: "stream" }),
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
