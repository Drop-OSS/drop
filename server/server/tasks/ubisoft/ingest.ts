import { createError } from "h3";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  streamUbisoftGameToCas,
  type UbisoftStreamProgress,
} from "../../utils/ubisoft/game-streamer";
import {
  getUbisoftOwnedTitles,
  refreshUbisoftSession,
  resolveUbisoftManifest,
  fetchUbisoftFileRecords,
} from "../../utils/ubisoft/client";

/**
 * Provider failures arrive as h3 errors carrying a status code; anything else
 * is an opaque failure that must not be inspected further.
 */
function statusCodeOf(error: unknown): number | undefined {
  return (error as { statusCode?: number } | null | undefined)?.statusCode;
}

/** Failure text for a job record: h3 errors carry a status message, and nothing
 * may leak an unfamiliar error shape into the job log. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface UbisoftIngestJobPayload {
  jobId: string;
  ticket: string;
  userId: string;
  spaceId: string;
  gameTitle: string;
  appVersion?: string;
}

export interface IngestJobStore {
  updateStatus: (
    jobId: string,
    status: "pending" | "downloading" | "processing" | "completed" | "failed",
    error?: string,
  ) => Promise<void>;
  updateProgress: (
    jobId: string,
    progress: {
      transferredBytes: number;
      totalBytes: number;
      currentFile: string;
    },
  ) => Promise<void>;
  setCompleted: (
    jobId: string,
    result: { manifestPath: string; totalBytes: number; fileCount: number },
  ) => Promise<void>;
}

/**
 * Executes direct stream ingestion of a Ubisoft Connect title into the
 * GameDepot CAS, following the shared adapter contract:
 * authorize (ticket) -> discover (ownership) -> normalize (manifest)
 * -> acquire (file records) -> verify (length checks during stream)
 * -> publish (atomic DropletManifest write).
 *
 * Ownership is re-verified before any byte is transferred: the account must
 * still own the title, otherwise the job fails closed without acquiring.
 */
export async function ingestUbisoftJob(
  payload: UbisoftIngestJobPayload,
  jobStore?: IngestJobStore,
  signal?: AbortSignal,
): Promise<{ manifestPath: string; totalBytes: number; fileCount: number }> {
  const { jobId, userId, spaceId, gameTitle, appVersion } = payload;
  let activeTicket = payload.ticket;

  const depotBase = resolve(
    process.env.GAMEDEPOT_DATA_DIR || "./data",
    "depot",
  );
  const objectsDir = resolve(depotBase, "objects");
  const manifestsDir = resolve(depotBase, "manifests");

  await mkdir(objectsDir, { recursive: true });
  await mkdir(manifestsDir, { recursive: true });

  try {
    if (signal?.aborted) {
      throw createError({
        statusCode: 499,
        statusMessage: "Job aborted before execution",
      });
    }

    if (jobStore) {
      await jobStore.updateStatus(jobId, "pending");
    }

    // 1. Discover: confirm the account still owns this title.
    const ownedTitles = await getUbisoftOwnedTitles(activeTicket, userId);
    if (!ownedTitles.some((t) => t.spaceId === spaceId)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Account does not own this Ubisoft title",
      });
    }

    if (jobStore) {
      await jobStore.updateStatus(jobId, "downloading");
    }

    let totalBytesTransferred = 0;
    const onProgress = (progress: UbisoftStreamProgress) => {
      totalBytesTransferred = progress.transferredBytes;
      if (jobStore) {
        jobStore
          .updateProgress(jobId, {
            transferredBytes: progress.transferredBytes,
            totalBytes: progress.totalBytes,
            currentFile: progress.currentFile,
          })
          .catch(() => {
            // non-blocking progress updates
          });
      }
    };

    // 2-3. Normalize/acquire: resolve the manifest and fetch file records,
    // refreshing the session once on ticket expiry (401).
    const runAcquisition = async (sessionTicket: string) => {
      const manifestInfo = await resolveUbisoftManifest(sessionTicket, spaceId);
      if (!manifestInfo) {
        throw createError({
          statusCode: 404,
          statusMessage: "No Ubisoft install manifest found for this title",
        });
      }
      return fetchUbisoftFileRecords(
        sessionTicket,
        manifestInfo.manifestId,
        signal,
      );
    };

    let fileRecords;
    try {
      fileRecords = await runAcquisition(activeTicket);
    } catch (err) {
      if (statusCodeOf(err) === 401) {
        const refreshed = await refreshUbisoftSession(activeTicket);
        activeTicket = refreshed.ticket;
        fileRecords = await runAcquisition(activeTicket);
      } else {
        throw err;
      }
    }

    if (fileRecords.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Ubisoft manifest contains no installable files",
      });
    }

    // 4-6. Acquire, verify and publish atomically.
    const result = await streamUbisoftGameToCas({
      fileRecords,
      gameTitle,
      appVersion,
      objectsDir,
      manifestsDir,
      signal,
      onProgress,
    });

    const completionData = {
      manifestPath: result.manifestPath,
      totalBytes: totalBytesTransferred,
      fileCount: result.manifest.files.length,
    };

    if (jobStore) {
      await jobStore.setCompleted(jobId, completionData);
    }

    return completionData;
  } catch (error) {
    if (jobStore) {
      await jobStore.updateStatus(
        jobId,
        "failed",
        messageOf(error) || "Ingest failed",
      );
    }
    throw error;
  }
}
