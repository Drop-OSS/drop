import { connect, type TLSSocket } from "node:tls";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import {
  UpstreamSchema,
  DownstreamSchema,
  ReqSchema,
  PushSchema,
  type Downstream,
  type Push,
  type Req,
  type Rsp,
  type Upstream,
} from "../../../internal/proto/ubisoft-demux/proto/demux_pb";

/**
 * Byte-level socket for Ubisoft's "demux" protocol.
 *
 * The Ubisoft Connect launcher does all of its privileged work (ownership,
 * install configuration, signed download URLs) over a long-lived TLS socket
 * to dmx.upc.ubisoft.com:443. Every message is a uint32 big-endian length
 * prefix followed by a protobuf `Upstream`/`Downstream` envelope
 * (mg.protocol.demux). Protocol shapes are vendored from the
 * YoobieRE/ubisoft-demux-node reference implementation (ubisoft-demux/).
 */

/** Launcher build number announced on connect; requests are refused without it.
 * Server answers ClientOutdatedPush (and disconnects) for stale builds - live
 * check Nov 2026: Ubisoft Connect 174.0.13368 is accepted, the reference's
 * 10931 is not. */
export const DEMUX_API_VERSION = 13368;
export const DEMUX_HOST = "dmx.upc.ubisoft.com";

export interface DemuxSocketEvents {
  /** A service reply or event delivered over an open service connection. */
  connectionData?: (connectionId: number, data: Buffer) => void;
  /** Any Downstream that is not a reply to a pending request. */
  push?: (downstream: Downstream) => void;
  close?: (error?: Error) => void;
}

type Pending = { resolve: (rsp: Rsp) => void; reject: (err: Error) => void };

export class DemuxSocket {
  private socket: TLSSocket | null = null;
  private pending = new Map<number, Pending>();
  private nextRequestId = 1;
  /** Receive buffer for the frame currently being assembled. */
  private buffer: Buffer | null = null;
  private expectedLength = 0;
  public events: DemuxSocketEvents = {};

  constructor(
    private readonly host: string = DEMUX_HOST,
    private readonly timeoutMs = 20_000,
  ) {}

  private async ensureSocket(): Promise<TLSSocket> {
    if (this.socket && !this.socket.destroyed) return this.socket;
    const socket = connect({
      port: 443,
      host: this.host,
      servername: this.host,
      // Live ground truth (Nov 2026): the endpoint RSTs TLS 1.3 ClientHellos
      // and negotiates TLS 1.2 - same as openssl s_client observes.
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
      socket.setTimeout(this.timeoutMs, () =>
        reject(new Error(`TLS handshake to ${this.host} timed out`)),
      );
    });
    socket.setTimeout(0);
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (error) => this.failAll(error));
    socket.on("close", () =>
      this.failAll(new Error("demux socket closed unexpectedly")),
    );
    this.socket = socket;

    // The clientVersion push must be the first message on the wire.
    await this.writeUpstream(
      create(UpstreamSchema, {
        push: create(PushSchema, {
          clientVersion: { version: DEMUX_API_VERSION },
        }),
      }),
    );
    return socket;
  }

  /** Frame reader tolerant of split and coalesced TCP chunks. */
  private onData(chunk: Buffer): void {
    let data = chunk;
    try {
      for (;;) {
        if (this.buffer === null) {
          if (data.length < 4) break;
          this.expectedLength = data.readUInt32BE(0);
          this.buffer = data.subarray(4);
          data = Buffer.alloc(0);
        } else {
          this.buffer = Buffer.concat([this.buffer, data]);
          data = Buffer.alloc(0);
        }
        if (this.buffer.length < this.expectedLength) break;
        const frame = this.buffer.subarray(0, this.expectedLength);
        const rest = this.buffer.subarray(this.expectedLength);
        this.buffer = null;
        this.handleDownstream(fromBinary(DownstreamSchema, frame));
        data = rest;
        if (data.length === 0) break;
      }
    } catch (error) {
      this.buffer = null;
      this.failAll(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleDownstream(downstream: Downstream): void {
    const rsp = downstream.response;
    if (rsp) {
      const waiter = this.pending.get(rsp.requestId);
      if (waiter) {
        this.pending.delete(rsp.requestId);
        waiter.resolve(rsp);
        return;
      }
    }
    if (downstream.push?.data) {
      this.events.connectionData?.(
        downstream.push.data.connectionId,
        Buffer.from(downstream.push.data.data),
      );
      return;
    }
    this.events.push?.(downstream);
  }

  private failAll(error: Error): void {
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  private async writeUpstream(upstream: Upstream): Promise<void> {
    const socket = await this.ensureSocket();
    const body = toBinary(UpstreamSchema, upstream);
    const frame = Buffer.alloc(4 + body.length);
    frame.writeUInt32BE(body.length, 0);
    frame.set(body, 4);
    await new Promise<void>((resolve, reject) =>
      socket.write(frame, (error) => (error ? reject(error) : resolve())),
    );
  }

  /** Send a top-level request and await the matching Rsp. */
  public async request(
    build: (requestId: number) => Partial<Omit<Req, "$typeName" | "requestId">>,
  ): Promise<Rsp> {
    const requestId = this.nextRequestId++;
    const upstream = create(UpstreamSchema, {
      request: create(ReqSchema, { requestId, ...build(requestId) }),
    });
    return new Promise<Rsp>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`demux request ${requestId} timed out`));
      }, this.timeoutMs);
      this.pending.set(requestId, {
        resolve: (rsp) => {
          clearTimeout(timer);
          resolve(rsp);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      void this.writeUpstream(upstream).catch((error) => {
        this.pending.delete(requestId);
        reject(error);
      });
    });
  }

  /** Fire-and-forget push (service payloads ride on these). */
  public async push(push: Push): Promise<void> {
    await this.writeUpstream(create(UpstreamSchema, { push }));
  }

  public destroy(): void {
    this.socket?.destroy();
    this.socket = null;
  }
}
