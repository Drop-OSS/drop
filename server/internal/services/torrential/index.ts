import { spawn } from "child_process";
import { Service } from "..";
import fs from "fs";
import { logger } from "../../logging";
import type { Socket } from "net";
import net from "net";
import { create, toBinary, type Message } from "@bufbuild/protobuf";
import { fromBinary } from "@bufbuild/protobuf";
import { StringValueSchema } from "@bufbuild/protobuf/wkt";
import type { GenMessage } from "@bufbuild/protobuf/codegenv2";
import {
  DropBoundSchema,
  TorrentialBoundSchema,
  TorrentialBoundType,
  type DropBound,
  type DropBoundType,
} from "../../proto/torrential/proto/core_pb";

/// Processors
import manifestFetchProcessor from "./manifest-fetch";
import serverGamesProcessor from "./server-games";

const INTERNAL_DEPOT_URL = new URL(
  process.env.INTERNAL_DEPOT_URL ?? "http://localhost:5000",
);

export interface QueryProcessor<
  T extends DropBoundType,
  K extends TorrentialBoundType,
  V extends Message,
> {
  queryType: T;
  run: (
    query: DropBound,
  ) => Promise<{ type: K; schema: GenMessage<V>; data: V } | undefined>;
}

export class TorrentialService extends Service<unknown> {
  private socket: Socket | undefined;
  private readbuf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private readingQueue = false;

  private queryProcessors: Map<
    DropBoundType,
    QueryProcessor<DropBoundType, TorrentialBoundType, Message>
  > = new Map();

  constructor() {
    super(
      "torrential",
      () => {
        const localDir = fs.readdirSync(".");
        if (localDir.includes("torrential")) {
          const stat = fs.statSync("./torrential");
          if (stat.isDirectory()) {
            // in dev and we have the submodule
            logger.info(
              "torrential detected in development mode - building from source",
            );
            return spawn(
              "cargo",
              ["run", "--manifest-path", "./torrential/Cargo.toml"],
              {},
            );
          } else {
            // binary
            return spawn("./torrential", [], {});
          }
        }

        const envPath = process.env.TORRENTIAL_PATH;
        if (envPath) return spawn(envPath, [], {});

        return spawn("torrential", [], {});
      },
      async () => {
        if (this.socket) return true;
        this.socket = net.createConnection({ port: 33148, host: "127.0.0.1" });
        await new Promise<void>((r) =>
          this.socket!.on("connect", () => {
            this.logger.info("connected to torrential socket");
            r();
          }),
        );

        this.setupRead();
        return true;
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      async () => await $fetch(`${INTERNAL_DEPOT_URL.toString()}healthcheck`),
      {},
    );

    this.queryProcessors.set(
      manifestFetchProcessor.queryType,
      manifestFetchProcessor,
    );
    this.queryProcessors.set(
      serverGamesProcessor.queryType,
      serverGamesProcessor,
    );
  }

  registerProcessor(
    processor: QueryProcessor<DropBoundType, TorrentialBoundType, Message>,
  ) {
    this.queryProcessors.set(processor.queryType, processor);
  }

  private setupRead() {
    if (!this.socket) return;
    this.socket.on("data", (data) => {
      this.readbuf = Buffer.concat([this.readbuf, data]);
      if (!this.readingQueue) {
        this.readingQueue = true;
        this.queueRead().finally(() => {
          this.readingQueue = false;
        });
      }
    });
  }

  async writeMessage<T extends Message>(
    messageId: string,
    value: {
      type: TorrentialBoundType;
      schema: GenMessage<T>;
      data: T;
    },
  ) {
    const response = create(TorrentialBoundSchema, {
      messageId: messageId,
      type: value.type,
      data: toBinary(value.schema, value.data),
    });

    const responseBinary = toBinary(TorrentialBoundSchema, response);
    const responseLength = responseBinary.length;

    const responseLengthBuf = Buffer.allocUnsafe(8);
    responseLengthBuf.writeBigUInt64LE(BigInt(responseLength), 0);

    this.socket!.write(responseLengthBuf);
    this.socket!.write(responseBinary);
  }

  private async queueRead() {
    if (this.readbuf.length < 8) return;
    const sizeBytes = this.readbuf.subarray(0, 8);
    const size = sizeBytes.readBigUInt64LE(0);
    const end = Number(size + BigInt(8));
    if (this.readbuf.length < end) return;

    const buffer = this.readbuf.subarray(8, end);
    this.readbuf = this.readbuf.subarray(end);
    const query = fromBinary(DropBoundSchema, buffer);
    const processor = this.queryProcessors.get(query.type);
    if (!processor) {
      this.logger.warn(`no processor for query type: ${query.type}`);
      return;
    }

    let value;

    try {
      value = await processor.run(query);
    } catch (e) {
      this.logger.warn(
        `process query for ${query.type} failed with error: ${e}`,
      );
      value = {
        type: TorrentialBoundType.ERROR,
        schema: StringValueSchema,
        data: create(StringValueSchema, {
          value: (e as string).toString(),
        }),
      };
    }

    if (value) await this.writeMessage(query.messageId, value);

    // Call until we can't
    await this.queueRead();
  }
}

export const TORRENTIAL_SERVICE = new TorrentialService();
export default TORRENTIAL_SERVICE;
