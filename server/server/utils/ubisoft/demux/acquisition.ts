import { create } from "@bufbuild/protobuf";
import { createError } from "h3";
import { DemuxClient } from "./client";
import { deriveUbisoftLaunches } from "../manifest";
import {
  UpstreamSchema as OwnershipUpstreamSchema,
  DownstreamSchema as OwnershipDownstreamSchema,
  ReqSchema as OwnershipReqSchema,
  InitializeReqSchema,
  SignOwnershipReqSchema,
  OwnershipTokenReqSchema,
  type InitializeRsp,
  type SignOwnershipRsp,
  type OwnershipTokenRsp,
} from "../../../internal/proto/ubisoft-demux/proto/ownership_pb";
import {
  UpstreamSchema as DownloadUpstreamSchema,
  DownstreamSchema as DownloadDownstreamSchema,
  ReqSchema as DownloadReqSchema,
  InitializeReqSchema as DownloadInitializeReqSchema,
  UrlReqSchema,
  type InitializeRsp as DownloadInitializeRsp,
  type UrlRsp,
} from "../../../internal/proto/ubisoft-demux/proto/download_service_pb";

/**
 * Acquisition API over the demux transport: everything needed to turn an
 * account ticket into signed CDN URLs for a title's files.
 *
 * Sequence, live-verified Nov 2026 against Anno 2070 (pid 22):
 *   ownership_service initialize -> ownedGames arrive inline in the reply
 *   signOwnership + ownershipToken -> credentials for download_service
 *   download_service initialize(productId, branch, expiry, signature, token)
 *   urlReq -> one UrlResponse per request, downloadUrls positional per path.
 *
 * The demux protocol answers well-formed requests and simply stays silent to
 * malformed ones (timeouts, not errors), so every shape here matches the
 * launcher's byte-exactly - do not "tidy" field usage without a live probe.
 */

/** Normalised per-game facts from the ownership initialisation reply. */
export type UbisoftOwnedGame = {
  productId: number;
  downloadId: number;
  /** Latest install manifest SHA-1 (upper-case hex); absent for some rows. */
  latestManifest: string | null;
  /** Active product branch (branch switching is out of scope). */
  branchId: number | null;
  /** Install configuration YAML: title, launch documents, redists. */
  configuration: string | null;
  title: string | null;
  /** Public-services space id: the reconciliation key with GraphQL rows. */
  spaceId: string | null;
  /** Relative launch executables from the configuration (may be empty). */
  launches: { name: string; executable: string }[];
  owned: boolean;
};

/** Download credentials minted by the ownership service. */
export type UbisoftDownloadCredentials = {
  branchId: number;
  expiration: bigint;
  /** Signature bytes are printable text; decoded for the string field. */
  signature: string;
  ownershipToken: string;
};

export class UbisoftAcquisitionClient {
  private constructor(
    private readonly client: DemuxClient,
    private readonly ownershipConnectionId: number,
  ) {}

  /** Connect, authenticate, and open the ownership service connection. */
  public static async connect(
    ubiTicket: string,
  ): Promise<UbisoftAcquisitionClient> {
    const client = new DemuxClient();
    try {
      await client.connect(ubiTicket);
      const ownershipConnectionId = await client.openConnection(
        "ownership_service",
        OwnershipUpstreamSchema,
        OwnershipDownstreamSchema,
      );
      return new UbisoftAcquisitionClient(client, ownershipConnectionId);
    } catch (error) {
      client.destroy();
      throw error;
    }
  }

  public destroy(): void {
    this.client.destroy();
  }

  /** Initialise the ownership service and return the account's games. */
  public async listOwnedGames(): Promise<UbisoftOwnedGame[]> {
    const rsp = (await this.client.serviceRequest(
      this.ownershipConnectionId,
      create(OwnershipUpstreamSchema, {
        request: create(OwnershipReqSchema, {
          initializeReq: create(InitializeReqSchema, {
            getAssociations: true,
            protoVersion: 7,
            useStaging: false,
          }),
        }),
      }),
    )) as InitializeRsp;
    if (!rsp.success) {
      throw createError({
        statusCode: 502,
        statusMessage: "Ubisoft ownership service refused initialisation",
      });
    }
    // Live shape (Nov 2026): owned games arrive inline in the init reply.
    // A missing container is not an empty library - it is an unexpected
    // protocol shape, so say so instead of reporting "you own nothing".
    if (!rsp.ownedGames) {
      throw createError({
        statusCode: 502,
        statusMessage:
          "Ubisoft ownership initialisation returned no owned-games container",
      });
    }
    return rsp.ownedGames.ownedGames.map((game) => {
      const config = game.configuration ?? "";
      const derived = deriveUbisoftLaunches(config);
      return {
        productId: game.productId,
        downloadId: game.downloadId || game.productId,
        latestManifest: game.latestManifest || null,
        branchId: game.activeBranchId || null,
        configuration: game.configuration || null,
        title: derived.title ?? null,
        spaceId: game.ubiservicesSpaceId || null,
        launches: derived.launches,
        owned: game.owned,
      };
    });
  }

  /** Mint ownership signature + token that unlock download_service. */
  public async getDownloadCredentials(
    productId: number,
  ): Promise<UbisoftDownloadCredentials> {
    const sign = (await this.client.serviceRequest(
      this.ownershipConnectionId,
      create(OwnershipUpstreamSchema, {
        request: create(OwnershipReqSchema, {
          signOwnershipReq: create(SignOwnershipReqSchema, { productId }),
        }),
      }),
    )) as SignOwnershipRsp;
    if (!sign.success || !sign.signature) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ubisoft refused to sign ownership for product ${productId}`,
      });
    }
    const token = (await this.client.serviceRequest(
      this.ownershipConnectionId,
      create(OwnershipUpstreamSchema, {
        request: create(OwnershipReqSchema, {
          ownershipTokenReq: create(OwnershipTokenReqSchema, { productId }),
        }),
      }),
    )) as OwnershipTokenRsp;
    if (!token.success || !token.token) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ubisoft refused an ownership token for product ${productId}`,
      });
    }
    return {
      branchId: sign.branchId,
      expiration: sign.expiration,
      signature: Buffer.from(sign.signature).toString("utf8"),
      ownershipToken: token.token,
    };
  }

  /**
   * Open download_service and initialise it for one product. Returns a
   * session whose mintUrls() calls answer with signed CDN URLs (ttl-limited;
   * mint in batches and re-mint on 403).
   */
  public async openDownloads(
    productId: number,
    credentials: UbisoftDownloadCredentials,
  ): Promise<UbisoftDownloadSession> {
    const connectionId = await this.client.openConnection(
      "download_service",
      DownloadUpstreamSchema,
      DownloadDownstreamSchema,
    );
    const rsp = (await this.client.serviceRequest(
      connectionId,
      create(DownloadUpstreamSchema, {
        request: create(DownloadReqSchema, {
          initializeReq: create(DownloadInitializeReqSchema, {
            productId,
            branchId: credentials.branchId,
            expiration: credentials.expiration,
            signature: credentials.signature,
            ownershipToken: credentials.ownershipToken,
            networkId: "LIVE",
          }),
        }),
      }),
    )) as DownloadInitializeRsp;
    if (!rsp.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ubisoft download service refused initialisation for product ${productId}`,
      });
    }
    return new UbisoftDownloadSession(this.client, connectionId, productId);
  }
}

export class UbisoftDownloadSession {
  constructor(
    private readonly client: DemuxClient,
    private readonly connectionId: number,
    private readonly productId: number,
  ) {}

  /**
   * Signed URLs for CDN-relative paths, positional: index i of the result
   * answers paths[i] (first candidate URL). Live shape: one UrlResponse per
   * request containing one DownloadUrls group per requested path.
   */
  public async mintUrls(paths: string[]): Promise<string[]> {
    if (paths.length === 0) return [];
    const rsp = (await this.client.serviceRequest(
      this.connectionId,
      create(DownloadUpstreamSchema, {
        request: create(DownloadReqSchema, {
          urlReq: create(UrlReqSchema, {
            urlRequests: [
              { productId: this.productId, relativeFilePath: paths },
            ],
          }),
        }),
      }),
    )) as UrlRsp;
    const group = rsp.urlResponses[0];
    if (!group || group.result !== 0) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ubisoft download service rejected the URL request for product ${this.productId}`,
      });
    }
    return paths.map((_, index) => {
      const url = group.downloadUrls[index]?.urls?.[0];
      if (!url) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft download service returned no URL for path #${index} of product ${this.productId}`,
        });
      }
      return url;
    });
  }
}
