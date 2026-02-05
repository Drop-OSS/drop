import type { Message } from "@bufbuild/protobuf";
import { create, fromBinary } from "@bufbuild/protobuf";
import {
  GenerateManifestSchema,
  ManifestCompleteSchema,
  ManifestErrorSchema,
  ManifestLogSchema,
  ManifestProgressSchema,
} from "../../proto/torrential/proto/droplet_pb";
import type { QueryProcessor } from ".";
import TORRENTIAL_SERVICE from ".";
import type { DropBound } from "../../proto/torrential/proto/core_pb";
import {
  DropBoundType,
  TorrentialBoundType,
} from "../../proto/torrential/proto/core_pb";
import { logger } from "../../logging";

interface ManifestGenerationCallbacks {
  resolve: (manifest: string) => void;
  reject: (err: string) => void;
  progress: (v: number) => void;
  log: (v: string) => void;
}

class DropletInterfaceManager {
  private manifestGenerationCallbacks: Map<
    string,
    ManifestGenerationCallbacks
  > = new Map();

  private queryProcessors: QueryProcessor<
    DropBoundType,
    TorrentialBoundType,
    Message
  >[];

  constructor() {
    const manifestCompleteProcessor = this.defineManifestQueryProcessor({
      queryType: DropBoundType.MANIFEST_COMPLETE,
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestCompleteSchema, message.data);

        callbacks.resolve(messageData.manifest);
        this.manifestGenerationCallbacks.delete(message.messageId);
      },
    });

    const manifestErrorProcessor = this.defineManifestQueryProcessor({
      queryType: DropBoundType.MANIFEST_ERROR,
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestErrorSchema, message.data);
        callbacks.reject(messageData.error);
        this.manifestGenerationCallbacks.delete(message.messageId);
      },
    });

    const manifestLogProcessor = this.defineManifestQueryProcessor({
      queryType: DropBoundType.MANIFEST_LOG,
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestLogSchema, message.data);
        callbacks.log(messageData.logLine);
      },
    });

    const manifestProgressProcessor = this.defineManifestQueryProcessor({
      queryType: DropBoundType.MANIFEST_PROGRESS,
      run: async (message, callbacks) => {
        const messageData = fromBinary(ManifestProgressSchema, message.data);
        callbacks.progress(messageData.progress);
      },
    });

    this.queryProcessors = [
      manifestCompleteProcessor,
      manifestErrorProcessor,
      manifestLogProcessor,
      manifestProgressProcessor,
    ];

    for (const processor of this.queryProcessors) {
      TORRENTIAL_SERVICE.registerProcessor(processor);
    }
  }

  private defineManifestQueryProcessor<
    T extends DropBoundType,
    K extends TorrentialBoundType,
    V extends Message,
  >(opts: {
    queryType: T;
    run: (
      query: DropBound,
      callbacks: ManifestGenerationCallbacks,
    ) => Promise<void>;
  }) {
    return {
      queryType: opts.queryType,
      run: async (message) => {
        const callbacks = this.manifestGenerationCallbacks.get(
          message.messageId,
        );
        if (!callbacks) {
          logger.warn(
            `got a manifest message with old message id: ${message.type}, ${message.messageId}`,
          );
          return undefined;
        }
        await opts.run(message, callbacks);
        return undefined;
      },
    } satisfies QueryProcessor<T, K, V>;
  }

  getProcessors() {
    return this.queryProcessors;
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
      this.manifestGenerationCallbacks.set(messageId, {
        resolve,
        reject,
        progress,
        log,
      });
    });
  }
}

export const dropletInterface = new DropletInterfaceManager();
export default dropletInterface;
