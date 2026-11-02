/**
 * Live demux acquisition probe (dev tool, run inside the builder container).
 * Maps the Ubisoft download chain against live services with the stored
 * account ticket: ownership init -> owned games -> manifests -> ownership
 * signature/token -> download_service init -> signed file URLs.
 *
 *   docker exec -e UBI_TICKET=... gamedepot-builder \
 *     sh -c 'cd /app/server && ./node_modules/.bin/tsx scripts/probe-ubisoft-demux.ts'
 *
 * Every secret is length-truncated; nothing printable identifies the account.
 */
import { create, toBinary, fromBinary, toJson } from "@bufbuild/protobuf";
import { DemuxSocket } from "../server/utils/ubisoft/demux/socket";
import { loginUbisoftWithRememberTicket } from "../server/utils/ubisoft/client";
import {
  AuthenticateReqSchema,
  OpenConnectionReqSchema,
  PushSchema,
} from "../server/internal/proto/ubisoft-demux/proto/demux_pb";
import * as own from "../server/internal/proto/ubisoft-demux/proto/ownership_pb";
import * as dl from "../server/internal/proto/ubisoft-demux/proto/download_service_pb";

const clip = (s: string, n = 90) =>
  s.length > n ? `${s.slice(0, n)}…(${s.length})` : s;

function scrub(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return clip(value);
  if (typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrub(v, depth + 1);
    return out;
  }
  return value;
}

const log = (label: string, obj: unknown) =>
  console.log(
    `\n### ${label}\n${JSON.stringify(scrub(obj), (k, v) => (v === "" ? undefined : v), 1)}`,
  );

const socket = new DemuxSocket();
type Conn = {
  schemas: { downstream: Parameters<typeof fromBinary>[0] };
  pending: Map<number, { resolve: (m: object) => void }>;
  nextId: number;
};
const conns = new Map<number, Conn>();

socket.events.connectionData = (cid: number, data: Buffer) => {
  const conn = conns.get(cid);
  if (!conn || data.length < 4) return;
  const len = data.readUInt32BE(0);
  if (data.length < 4 + len) return console.log(`short frame cid=${cid}`);
  let msg: Record<string, unknown>;
  try {
    msg = fromBinary(
      conn.schemas.downstream,
      data.subarray(4, 4 + len),
    ) as unknown as Record<string, unknown>;
  } catch (e) {
    return console.log(`decode fail cid=${cid}: ${String(e)}`);
  }
  const rsp = msg.response as { requestId?: number } | undefined;
  if (rsp?.requestId !== undefined && conn.pending.has(rsp.requestId)) {
    conn.pending.get(rsp.requestId)!.resolve(msg);
    conn.pending.delete(rsp.requestId);
    return;
  }
  // Unsolicited push (OwnedGamePush etc.): log it, we came for ground truth.
  for (const key of Object.keys(msg)) {
    if (key === "$typeName") continue;
    log(`push cid=${cid} ${key}`, msg[key]);
  }
};

/** Demux replies read as loose objects in this probe. */
type LooseRsp = Record<string, unknown> & {
  response?: Record<string, unknown>;
};

function serviceRequest<T>(
  cid: number,
  upstream: T,
  label: string,
  timeoutMs = 12_000,
): Promise<LooseRsp> {
  const conn = conns.get(cid)!;
  const requestId = conn.nextId++;
  const req = (upstream as { request?: Record<string, unknown> }).request;
  if (!req) throw new Error("missing request envelope");
  req.requestId = requestId;
  req.ubiSessionId = crypto.randomUUID();
  const inner = toBinary(
    (conn as unknown as { schemas: { upstream: never } }).schemas.upstream,
    upstream as never,
  );
  const framed = Buffer.alloc(4 + inner.length);
  framed.writeUInt32BE(inner.length, 0);
  framed.set(inner, 4);
  return new Promise<LooseRsp>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`${label}: TIMEOUT (no reply within ${timeoutMs}ms)`)),
      timeoutMs,
    );
    conn.pending.set(requestId, {
      resolve: (m) => {
        clearTimeout(timer);
        resolve(m as LooseRsp);
      },
    });
    socket
      .push(create(PushSchema, { data: { connectionId: cid, data: framed } }))
      .catch((e) => {
        clearTimeout(timer);
        conn.pending.delete(requestId);
        reject(e);
      });
  });
}

async function openService(
  name: string,
  upstream: never,
  downstream: never,
): Promise<number> {
  const rsp = await socket.request(() => ({
    openConnectionReq: create(OpenConnectionReqSchema, { serviceName: name }),
  }));
  if (!rsp.openConnectionRsp?.success) throw new Error(`open ${name} refused`);
  const cid = rsp.openConnectionRsp.connectionId;
  conns.set(cid, {
    schemas: { upstream, downstream } as never,
    pending: new Map(),
    nextId: 1,
  });
  console.log(`opened ${name} cid=${cid}`);
  return cid;
}

async function main() {
  const { openSecret } =
    await import("../server/utils/depot/credential-crypto");
  let ticket = openSecret(process.env.UBI_TICKET ?? null);
  if (!ticket && process.env.UBI_RM) {
    console.log("minting session from remember-me ticket…");
    const session = await loginUbisoftWithRememberTicket(
      openSecret(process.env.UBI_RM) as string,
    );
    ticket = session.ticket;
    console.log(`session ok user=${session.userId.slice(0, 8)}…`);
  }
  if (!ticket) throw new Error("UBI_TICKET or UBI_RM env required");
  const auth = await socket.request(() => ({
    authenticateReq: create(AuthenticateReqSchema, {
      token: { ubiTicket: ticket },
      clientId: "uplay_pc",
    }),
  }));
  log("authenticate", auth.authenticateRsp ?? auth);
  if (!auth.authenticateRsp?.success) throw new Error("auth failed");

  // --- ownership: init + owned games push -------------------------------
  const ocid = await openService(
    "ownership_service",
    own.UpstreamSchema as never,
    own.DownstreamSchema as never,
  );
  const init = await serviceRequest(
    ocid,
    create(own.UpstreamSchema, {
      request: create(own.ReqSchema, {
        initializeReq: create(own.InitializeReqSchema, {
          getAssociations: true,
          protoVersion: 7,
          useStaging: false,
        }),
      }),
    }),
    "ownership.initialize",
  );
  log("ownership.initializeRsp", init.response?.initializeRsp ?? init);
  // Full install configuration YAML for the probed product (launch doc).
  const pidEnv = Number(process.env.UBI_PID ?? "0");
  const games =
    (
      init.response?.initializeRsp as {
        ownedGames?: {
          ownedGames?: { productId?: number; configuration?: string }[];
        };
      }
    )?.ownedGames?.ownedGames ?? [];
  const target = games.find((g) => g.productId === pidEnv);
  if (target?.configuration) {
    console.log(
      `\n### configuration (pid ${pidEnv}):\n${target.configuration}`,
    );
  }
  // Owned games arrive as pushes after init; give them a moment.
  await new Promise((r) => setTimeout(r, 2500));

  // Pull game descriptors out of the last push we recorded: re-request via
  // DeprecatedGetLatestManifests needs concrete product ids, which the
  // library GraphQL route already knows; here we just ask ownership for a
  // known product id passed in env.
  const pid = Number(process.env.UBI_PID ?? "0");
  if (!pid)
    return console.log(
      "\n(no UBI_PID set: stopping after owned-games capture)",
    );

  const manifests = await serviceRequest(
    ocid,
    create(own.UpstreamSchema, {
      request: create(own.ReqSchema, {
        deprecatedGetLatestManifestsReq: create(
          own.DeprecatedGetLatestManifestsReqSchema,
          {
            deprecatedProductIds: [pid],
          },
        ),
      }),
    }),
    "ownership.latestManifests",
  );
  log(
    "deprecatedGetLatestManifestsRsp",
    manifests.response?.deprecatedGetLatestManifestsRsp ?? manifests,
  );

  const sign = await serviceRequest(
    ocid,
    create(own.UpstreamSchema, {
      request: create(own.ReqSchema, {
        signOwnershipReq: create(own.SignOwnershipReqSchema, {
          productId: pid,
        }),
      }),
    }),
    "ownership.signOwnership",
  );
  const signRsp = sign.response?.signOwnershipRsp as
    | {
        success?: boolean;
        branchId?: number;
        expiration?: bigint;
        signature?: string;
      }
    | undefined;
  const signBytes = signRsp?.signature as unknown;
  const signatureText =
    typeof signBytes === "string"
      ? signBytes
      : Buffer.from((signBytes as Uint8Array) ?? new Uint8Array()).toString(
          "utf8",
        );
  log("signOwnershipRsp", {
    ...signRsp,
    signature: `bytes(${(signBytes as Uint8Array)?.length ?? 0})`,
  });

  const tok = await serviceRequest(
    ocid,
    create(own.UpstreamSchema, {
      request: create(own.ReqSchema, {
        ownershipTokenReq: create(own.OwnershipTokenReqSchema, {
          productId: pid,
        }),
      }),
    }),
    "ownership.ownershipToken",
  );
  const tokRsp = tok.response?.ownershipTokenRsp as
    | { success?: boolean; token?: string; expiration?: bigint }
    | undefined;
  log("ownershipTokenRsp", {
    success: tokRsp?.success,
    token: `len(${tokRsp?.token?.length ?? 0})`,
    expiration: String(tokRsp?.expiration ?? ""),
  });

  const manifest = process.env.UBI_MANIFEST ?? "";
  const pathCandidates = manifest
    ? [`manifests/${manifest}.manifest`, "uplay_install.manifest"]
    : ["uplay_install.manifest"];

  try {
    const batch = await serviceRequest(
      ocid,
      create(own.UpstreamSchema, {
        request: create(own.ReqSchema, {
          getBatchDownloadUrlsReq: create(own.GetBatchDownloadUrlsReqSchema, {
            urlRequests: [
              { productId: pid, relativeFilePaths: pathCandidates },
            ],
          }),
        }),
      }),
      "ownership.batchDownloadUrls(probe)",
      8000,
    );
    log(
      "getBatchDownloadUrlsRsp",
      batch.response?.getBatchDownloadUrlsRsp ?? batch,
    );
  } catch (e) {
    console.log(`\n### getBatchDownloadUrlsRsp: ${(e as Error).message}`);
  }

  // --- download_service -----------------------------------------------
  const dcid = await openService(
    "download_service",
    dl.UpstreamSchema as never,
    dl.DownstreamSchema as never,
  );
  const dinit = await serviceRequest(
    dcid,
    create(dl.UpstreamSchema, {
      request: create(dl.ReqSchema, {
        initializeReq: create(dl.InitializeReqSchema, {
          productId: pid,
          branchId: signRsp?.branchId ?? 0,
          expiration: signRsp?.expiration ?? 0n,
          signature: signatureText,
          ownershipToken: tokRsp?.token ?? "",
          networkId: "LIVE",
        }),
      }),
    }),
    "download.initialize",
  );
  log("download.initializeRsp", dinit.response?.initializeRsp ?? dinit);

  const urls = await serviceRequest(
    dcid,
    create(dl.UpstreamSchema, {
      request: create(dl.ReqSchema, {
        urlReq: create(dl.UrlReqSchema, {
          urlRequests: [{ productId: pid, relativeFilePath: pathCandidates }],
        }),
      }),
    }),
    "download.urlReq(manifest candidates)",
  );
  log("download.urlRsp", urls.response?.urlRsp ?? urls);

  // --- fetch + parse the install manifest ------------------------------
  if (manifest) {
    let raw: Buffer | null = null;
    let used = "";
    const responses =
      (
        urls.response?.urlRsp as {
          urlResponses?: { downloadUrls?: { urls: string[] }[] }[];
        }
      )?.urlResponses ?? [];
    // One UrlResponse per request; downloadUrls inside is positional per path.
    const urlEntries = responses.flatMap((r) => r.downloadUrls ?? []);
    if (!raw)
      for (const [i, entry] of urlEntries.entries()) {
        const u = entry.urls?.[0];
        if (!u) continue;
        const res = await fetch(u);
        console.log(
          `candidate ${i} (${pathCandidates[i]}): HTTP ${res.status}`,
        );
        if (res.ok) {
          raw = Buffer.from(await res.arrayBuffer());
          used = pathCandidates[i] ?? "?";
          break;
        }
      }
    if (!raw) throw new Error("no manifest candidate fetched");
    const data = raw;
    console.log(`\n### manifest via ${used}: ${data.length} bytes`);
    console.log("head16:", data.subarray(0, 16).toString("hex"));
    console.log("bytes352-372:", data.subarray(352, 372).toString("hex"));
    const magics: number[] = [];
    for (let i = 0; i < data.length - 1 && magics.length < 5; i++)
      if (data[i] === 0x1f && data[i + 1] === 0x8b) magics.push(i);
    console.log("gzip-magic offsets:", magics);
    const { gunzipSync, inflateSync, inflateRawSync } =
      await import("node:zlib");
    let payload: Buffer | null = null;
    const attempts: [string, () => Buffer][] = [
      ["inflate@356", () => inflateSync(data.subarray(356))],
      ["inflateRaw@356", () => inflateRawSync(data.subarray(356))],
      ["gunzip@356", () => gunzipSync(data.subarray(356))],
      ["inflate@0", () => inflateSync(raw)],
      ["inflateRaw@0", () => inflateRawSync(raw)],
      ["gunzip@0", () => gunzipSync(raw)],
      ...(magics.length
        ? ([
            [
              `inflate@${magics[0]}`,
              () => inflateSync(data.subarray(magics[0])),
            ],
            [`gunzip@${magics[0]}`, () => gunzipSync(data.subarray(magics[0]))],
          ] as [string, () => Buffer][])
        : []),
    ];
    for (const [label, fn] of attempts) {
      try {
        payload = fn();
        console.log(`decompressed via ${label}: ${payload.length} bytes`);
        break;
      } catch (e) {
        console.log(`${label}: ${(e as Error).message.slice(0, 40)}`);
      }
    }
    if (!payload) {
      // Maybe the payload is bare protobuf (older format, no compression).
      payload = data.subarray(356);
      console.log("trying bare protobuf at 356");
    }
    const { ManifestSchema } =
      await import("../server/internal/proto/ubisoft-demux/proto/download_pb");
    const manifestMsg = fromBinary(ManifestSchema, payload);
    const m = manifestMsg as unknown as {
      gameVersion?: string;
      isCompressed?: boolean;
      compressionMethod?: number;
      chunks?: {
        id: number;
        type: number;
        language?: string;
        files?: unknown[];
      }[];
      installRuns?: {
        exe: string;
        arguments?: string;
        description?: string;
        workingDir?: string;
      }[];
      languages?: { code?: string }[];
      slicerConfig?: unknown;
    };
    const fileCount = (m.chunks ?? []).reduce(
      (n, c) => n + (c.files?.length ?? 0),
      0,
    );
    log("manifest", {
      gameVersion: m.gameVersion,
      isCompressed: m.isCompressed,
      compressionMethod: m.compressionMethod,
      languages: m.languages,
      chunks: (m.chunks ?? []).map((c) => ({
        id: c.id,
        type: c.type,
        language: c.language,
        files: c.files?.length,
      })),
      installRuns: m.installRuns,
      totalFiles: fileCount,
      slicerConfig: m.slicerConfig,
    });
    // First file entries for byte layout ground truth.
    const files = (m.chunks ?? [])
      .flatMap(
        (c) =>
          (c.files ?? []) as {
            name?: string;
            size?: string | number;
            isDir?: boolean;
            slices?: unknown[];
            sliceList?: unknown[];
          }[],
      )
      .slice(0, 3);
    log(
      "sample files",
      files.map((f) => ({
        name: f.name,
        size: String(f.size),
        isDir: f.isDir,
        slices: (f.slices ?? []).length,
        sliceList: (f.sliceList ?? []).length,
      })),
    );
  }
}

main()
  .then(() => console.log("\nPROBE_DONE"))
  .catch((e) =>
    console.log(`\nPROBE_FAIL: ${e?.statusMessage ?? e?.message ?? e}`),
  )
  .finally(() => socket.destroy());
