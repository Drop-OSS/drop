/*
The purpose of this class is to hold references to remote objects (like images) until they're actually needed
This is used as a utility in metadata handling, so we only fetch the objects if we're actually creating a database record.
*/
import { v4 as uuidv4 } from 'uuid';

type TransactionTable = { [key: string]: string }; // ID to URL
type GlobalTransactionRecord = { [key: string]: TransactionTable }; // Transaction ID to table

type Register = (url: string) => string;
type Pull = () => Promise<void>;
type Dump = () => void;

export class ObjectTransactionalHandler {
    private record: GlobalTransactionRecord = {};

    new(): [Register, Pull, Dump] {
        const transactionId = uuidv4();

        const register = (url: string) => {
            const objectId = uuidv4();
            this.record[transactionId][objectId] = url;

            return objectId;
        }

        const pull = async () => {
            // Dummy function
            dump();
        }

        const dump = () => {
            delete this.record[transactionId];
        }

        return [register, pull, dump];
    }
}