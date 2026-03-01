import type { Message } from "@bufbuild/protobuf";
import { create, fromBinary } from "@bufbuild/protobuf";
import {
  ClientCertQuerySchema,
  ClientCertResponseSchema,
  GenerateManifestSchema,
  HasBackendQuerySchema,
  HasBackendResponseSchema,
  ListFilesQuerySchema,
  ListFilesResponseSchema,
  ManifestCompleteSchema,
  ManifestLogSchema,
  ManifestProgressSchema,
  PeekFileQuerySchema,
  PeekFileResponseSchema,
  RootCertQuerySchema,
  RootCertResponseSchema,
  RpcErrorSchema,
} from "../../proto/torrential/proto/droplet_pb";
import type { QueryProcessor } from ".";
import TORRENTIAL_SERVICE from ".";
import type { DropBound } from "../../proto/torrential/proto/core_pb";
import {
  DropBoundType,
  TorrentialBoundType,
} from "../../proto/torrential/proto/core_pb";
import { logger } from "../../logging";
import type { CertificateBundle } from "../../clients/ca";
import type { GenMessage } from "@bufbuild/protobuf/codegenv2";

interface BaseCallbacks<T> {
  resolve: (value: T) => void;

  reject: (err: string) => void;
}

type ManifestGenerationCallbacks = BaseCallbacks<string> & {
  progress: (v: number) => void;
  log: (v: string) => void;
  type: "manifest";
};

type CaGenerationCallback = BaseCallbacks<CertificateBundle> & {
  type: "certificate";
};

type HasBackendCallback = BaseCallbacks<boolean> & {
  type: "has_backend";
};

type ListFilesCallback = BaseCallbacks<string[]> & {
  type: "list_files";
};

type PeekFileCallback = BaseCallbacks<number> & {
  type: "peek_file";
};

type DropletFunctionCallbacks =
  | ManifestGenerationCallbacks
  | CaGenerationCallback
  | HasBackendCallback
  | ListFilesCallback
  | PeekFileCallback;

class DropletInterfaceManager {
  private callbacks: Map<string, DropletFunctionCallbacks> = new Map();

  private queryProcessors: QueryProcessor<
    DropBoundType,
    TorrentialBoundType,
    Message
  >[];

  constructor() {
    // This handler is special, it's a global error handler
    const errorProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.RPC_ERROR,
      run: async (message, callbacks) => {
        const messageData = fromBinary(RpcErrorSchema, message.data);
        callbacks.reject(messageData.error);
        this.callbacks.delete(message.messageId);
      },
    });

    // Other than the error handler, each "_COMPLETE" handler is responsible
    // for resolving the promise, and cleaning themselves up (removing from map)
    const manifestCompleteProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.MANIFEST_COMPLETE,
      callbackType: "manifest",
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestCompleteSchema, message.data);

        callbacks.resolve(messageData.manifest);
        this.callbacks.delete(message.messageId);
      },
    });

    const manifestLogProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.MANIFEST_LOG,
      callbackType: "manifest",
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestLogSchema, message.data);
        callbacks.log(messageData.logLine);
      },
    });

    const manifestProgressProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.MANIFEST_PROGRESS,
      callbackType: "manifest",
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestProgressSchema, message.data);
        callbacks.progress(messageData.progress);
      },
    });

    const rootCaProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.ROOT_CA_COMPLETE,
      callbackType: "certificate",
      run: async (message, callbacks) => {
        const messageData = fromBinary(RootCertResponseSchema, message.data);
        callbacks.resolve({
          priv: messageData.priv,
          cert: messageData.cert,
        } satisfies CertificateBundle);
        this.callbacks.delete(message.messageId);
      },
    });

    const clientCertProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.CLIENT_CERT_COMPLETE,
      callbackType: "certificate",
      run: async (message, callbacks) => {
        const messageData = fromBinary(ClientCertResponseSchema, message.data);
        callbacks.resolve({
          cert: messageData.cert,
          priv: messageData.priv,
        });
        this.callbacks.delete(message.messageId);
      },
    });

    const hasBackendProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.HAS_BACKEND_COMPLETE,
      callbackType: "has_backend",
      run: async (message, callbacks) => {
        const messageData = fromBinary(HasBackendResponseSchema, message.data);
        callbacks.resolve(messageData.result);
        this.callbacks.delete(message.messageId);
      },
    });

    const listFilesProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.LIST_FILES_COMPLETE,
      callbackType: "list_files",
      run: async (message, callbacks) => {
        const messageData = fromBinary(ListFilesResponseSchema, message.data);
        callbacks.resolve(messageData.files);
        this.callbacks.delete(message.messageId);
      },
    });

    const peekFileProcessor = this.defineDropletCallbackProcessor({
      queryType: DropBoundType.PEEK_FILE_COMPLETE,
      callbackType: "peek_file",
      run: async (message, callbacks) => {
        const messageData = fromBinary(PeekFileResponseSchema, message.data);
        callbacks.resolve(Number(messageData.size));
        this.callbacks.delete(message.messageId);
      },
    });

    // All query processors go into the array to get added
    this.queryProcessors = [
      errorProcessor,
      manifestCompleteProcessor,
      manifestLogProcessor,
      manifestProgressProcessor,
      rootCaProcessor,
      clientCertProcessor,
      hasBackendProcessor,
      listFilesProcessor,
      peekFileProcessor,
    ];

    for (const processor of this.queryProcessors) {
      TORRENTIAL_SERVICE.registerProcessor(processor);
    }
  }

  /**
   * Defines a handler to consume an incoming message
   * from torrential
   *
   * Passes in the query type (DropBoundType) and callback type,
   * to make sure we respond to right callback,
   * and give us proper typing when it comes to the callbacks (resolve, specifically)
   *
   * Returns a query processor that can be registered with the service
   */
  private defineDropletCallbackProcessor<
    T extends DropBoundType,
    K extends TorrentialBoundType,
    V extends Message,
    C extends DropletFunctionCallbacks,
    CT extends C["type"],
  >(opts: {
    queryType: T;
    callbackType?: CT;
    run: (
      query: DropBound,
      callbacks: Extract<C, { type: CT }>,
    ) => Promise<void>;
  }) {
    return {
      queryType: opts.queryType,
      run: async (message) => {
        const callbacks = this.callbacks.get(message.messageId);
        if (!callbacks) {
          logger.debug(
            `got a droplet message with old message id: ${message.type}, ${message.messageId}`,
          );
          return undefined;
        }
        if (opts.callbackType && callbacks.type !== opts.callbackType)
          return undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await opts.run(message, callbacks as any);
        return undefined;
      },
    } satisfies QueryProcessor<T, K, V>;
  }

  getProcessors() {
    return this.queryProcessors;
  }

  /**
   * Sets up message ID,
   * sends request to torrential,
   * and sets up callbacks
   */
  private async createDropletFunction<
    M extends Message,
    K extends DropletFunctionCallbacks,
    KT extends K["type"],
  >(
    message: M,
    schema: GenMessage<M>,
    messageType: TorrentialBoundType,
    callbackType: KT,
  ): Promise<Parameters<Extract<K, { type: KT }>["resolve"]>[0]> {
    await TORRENTIAL_SERVICE.waitServiceHealthy();
    const messageId = crypto.randomUUID();

    await TORRENTIAL_SERVICE.writeMessage(messageId, {
      type: messageType,
      schema: schema,
      data: message,
    });

    return await new Promise((resolve, reject) => {
      this.callbacks.set(messageId, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: callbackType as any,
        resolve,
        reject,
      });
    });
  }

  async generateDropletManifest(
    versionDir: string,
    progress: (v: number) => void,
    log: (v: string) => void,
  ) {
    const messageId = crypto.randomUUID();
    const manifestGenerationRequest = create(GenerateManifestSchema, {
      versionDir,
    });

    await TORRENTIAL_SERVICE.writeMessage(messageId, {
      type: TorrentialBoundType.GENERATE_MANIFEST,
      schema: GenerateManifestSchema,
      data: manifestGenerationRequest,
    });

    return await new Promise<string>((resolve, reject) => {
      this.callbacks.set(messageId, {
        resolve,
        reject,
        progress,
        log,
        type: "manifest",
      });
    });
  }

  async generateRootCa() {
    return await this.createDropletFunction(
      create(RootCertQuerySchema, {}),
      RootCertQuerySchema,
      TorrentialBoundType.GENERATE_ROOT_CA,
      "certificate",
    );
  }

  async generateClientCert(
    clientId: string,
    clientName: string,
    rootCa: CertificateBundle,
  ) {
    return await this.createDropletFunction(
      create(ClientCertQuerySchema, {
        clientId,
        clientName,
        rootPriv: rootCa.priv,
        rootCert: rootCa.cert,
      }),
      ClientCertQuerySchema,
      TorrentialBoundType.GENERATE_CLIENT_CERT,
      "certificate",
    );
  }

  async hasBackend(path: string) {
    return await this.createDropletFunction(
      create(HasBackendQuerySchema, {
        path,
      }),
      HasBackendQuerySchema,
      TorrentialBoundType.HAS_BACKEND_QUERY,
      "has_backend",
    );
  }

  async listFiles(path: string) {
    return await this.createDropletFunction(
      create(ListFilesQuerySchema, {
        path,
      }),
      ListFilesQuerySchema,
      TorrentialBoundType.LIST_FILES_QUERY,
      "list_files",
    );
  }

  async peekFile(path: string, subpath: string) {
    return await this.createDropletFunction(
      create(PeekFileQuerySchema, {
        path: path,
        filename: subpath,
      }),
      PeekFileQuerySchema,
      TorrentialBoundType.PEEK_FILE_QUERY,
      "peek_file",
    );
  }
}

export const dropletInterface = new DropletInterfaceManager();
export default dropletInterface;
