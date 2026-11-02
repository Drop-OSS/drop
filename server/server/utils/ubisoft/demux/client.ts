import {
  create,
  toBinary,
  fromBinary,
  type DescMessage,
  type Message,
} from "@bufbuild/protobuf";
import { randomUUID } from "node:crypto";
import { createError } from "h3";
import { DemuxSocket } from "./socket";
import {
  AuthenticateReqSchema,
  OpenConnectionReqSchema,
  PushSchema,
} from "../../../internal/proto/ubisoft-demux/proto/demux_pb";
import {
  UpstreamSchema as OwnershipUpstreamSchema,
  DownstreamSchema as OwnershipDownstreamSchema,
  ReqSchema as OwnershipReqSchema,
} from "../../../internal/proto/ubisoft-demux/proto/ownership_pb";

/**
 * High-level demux client: ticket auth, service connections, and
 * request/response matching inside a connection.
 *
 * Flow (per the vendored reference implementation):
 *  1. socket opens and pushes clientVersion
 *  2. authenticate with the account's Ubi_v1 ticket
 *  3. openConnection(serviceName) yields a connection id
 *  4. service calls ride on Push.DataMessage frames: the inner service
 *     Upstream is itself uint32BE-length-prefixed inside `data`; replies
 *     arrive as connectionData with the same prefix, decoded against the
 *     service Downstream type and matched by the inner request id.
 */

const REQUEST_TIMEOUT_MS = 25_000;

/** Services reachable via openConnection (reference client set). */
export type DemuxServiceName =
  | "client_configuration_service"
  | "cloudsave_service"
  | "denuvo_service"
  | "download_service"
  | "friends_service"
  | "ownership_service"
  | "party_service"
  | "playtime_service"
  | "store_service"
  | "utility_service";

type Waiter = {
  resolve: (rsp: Message) => void;
  reject: (err: Error) => void;
};

type ConnectionState = {
  upstreamSchema: DescMessage;
  downstreamSchema: DescMessage;
  nextRequestId: number;
  pending: Map<number, Waiter>;
  /** Some services want a session id stamped on each request (ownership). */
  stampSessionId: boolean;
};

export class DemuxClient {
  private socket: DemuxSocket | null = null;
  private connections = new Map<number, ConnectionState>();

  /** Open the socket and authenticate with a Ubi_v1 ticket. */
  public async connect(ubiTicket: string): Promise<void> {
    const socket = new DemuxSocket();
    socket.events.connectionData = (connectionId, data) =>
      this.onConnectionData(connectionId, data);
    this.socket = socket;
    let rsp;
    try {
      rsp = await socket.request(() => ({
        authenticateReq: create(AuthenticateReqSchema, {
          token: { ubiTicket },
          clientId: "uplay_pc",
        }),
      }));
    } catch (error) {
      socket.destroy();
      this.socket = null;
      throw error;
    }
    const auth = rsp.authenticateRsp;
    if (!auth?.success) {
      socket.destroy();
      this.socket = null;
      throw createError({
        statusCode: 401,
        statusMessage: `Ubisoft demux rejected the stored ticket${
          auth?.expired ? " (expired - reconnect the account)" : ""
        }`,
      });
    }
  }

  /**
   * Open a service connection. Pass the service's Upstream/Downstream
   * schemas so replies can be decoded and the inner request id located.
   */
  public async openConnection(
    serviceName: DemuxServiceName,
    upstreamSchema: DescMessage,
    downstreamSchema: DescMessage,
  ): Promise<number> {
    if (!this.socket) throw new Error("demux client is not connected");
    const rsp = await this.socket.request(() => ({
      openConnectionReq: create(OpenConnectionReqSchema, { serviceName }),
    }));
    const opened = rsp.openConnectionRsp;
    if (!opened?.success) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ubisoft demux refused the ${serviceName} connection`,
      });
    }
    this.connections.set(opened.connectionId, {
      upstreamSchema,
      downstreamSchema,
      nextRequestId: 1,
      pending: new Map(),
      stampSessionId: serviceName === "ownership_service",
    });
    return opened.connectionId;
  }

  /** Send one service request inside a connection and await its response. */
  public async serviceRequest(
    connectionId: number,
    upstream: Message,
  ): Promise<Message> {
    const socket = this.socket;
    const conn = this.connections.get(connectionId);
    if (!socket || !conn) {
      throw new Error(`demux connection ${connectionId} is not open`);
    }
    const requestId = conn.nextRequestId++;
    const request = (upstream as { request?: Record<string, unknown> }).request;
    if (!request) throw new Error("service upstream is missing its request");
    request.requestId = requestId;
    if (conn.stampSessionId) request.ubiSessionId = randomUUID();

    const inner = toBinary(conn.upstreamSchema, upstream);
    const prefixed = Buffer.alloc(4 + inner.length);
    prefixed.writeUInt32BE(inner.length, 0);
    prefixed.set(inner, 4);

    return new Promise<Message>((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pending.delete(requestId);
        reject(new Error(`demux service request ${requestId} timed out`));
      }, REQUEST_TIMEOUT_MS);
      conn.pending.set(requestId, {
        resolve: (rsp) => {
          clearTimeout(timer);
          resolve(rsp);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      void socket
        .push(create(PushSchema, { data: { connectionId, data: prefixed } }))
        .catch((error: unknown) => {
          clearTimeout(timer);
          conn.pending.delete(requestId);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  private onConnectionData(connectionId: number, data: Buffer): void {
    const conn = this.connections.get(connectionId);
    if (!conn || data.length < 4) return;
    const length = data.readUInt32BE(0);
    if (data.length < 4 + length) return; // fragmented inner payload
    let downstream: Message;
    try {
      downstream = fromBinary(
        conn.downstreamSchema,
        data.subarray(4, 4 + length),
      );
    } catch {
      return;
    }
    const rsp = (downstream as { response?: { requestId?: number } }).response;
    const requestId = rsp?.requestId;
    if (requestId === undefined) return;
    const waiter = conn.pending.get(requestId);
    if (!waiter) return;
    conn.pending.delete(requestId);
    waiter.resolve(rsp as unknown as Message);
  }

  public destroy(): void {
    this.socket?.destroy();
    this.socket = null;
    this.connections.clear();
  }
}

/** Ownership service schema pair for openConnection(). */
export const OWNERSHIP_SCHEMAS = {
  upstream: OwnershipUpstreamSchema,
  downstream: OwnershipDownstreamSchema,
};

/** Ownership request envelope (for create(OwnershipUpstreamSchema,...)). */
export { OwnershipReqSchema };
