/**
 * Integration tests for FsObjectBackend hash store.
 *
 * Verifies the SHA-256 content fingerprint migration from MD5. The hash is
 * used as a content-addressed key for object deduplication — a SHA-256 collision
 * would only cause two different objects to share a storage slot, which is
 * a nuisance (not a security breach). MD5 was replaced because SonarCloud
 * flagged it as a weak hash algorithm (S4790).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const inMemoryCache = new Map<string, string>();

vi.mock("~/server/internal/cache", () => ({
  default: {
    createCache: () => {
      const map = new Map<string, string>();
      return {
        get: async (key: string) => map.get(key) ?? null,
        set: async (key: string, value: string) => {
          map.set(key, value);
        },
        remove: async (key: string) => {
          map.delete(key);
        },
        has: async (key: string) => map.has(key),
        clear: async () => map.clear(),
      };
    },
  },
}));

vi.mock("~/server/internal/db/database", () => ({
  default: {
    objectHash: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        const cached = inMemoryCache.get(where.id);
        return cached ? { hash: cached } : null;
      }),
      upsert: vi.fn().mockImplementation(async ({ where, create, update }) => {
        if (update) {
          inMemoryCache.set(where.id, update.hash);
        }
        return { id: where.id, hash: create.hash };
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }) => {
        if (inMemoryCache.has(where.id)) {
          inMemoryCache.delete(where.id);
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  },
}));

vi.mock("~/server/internal/config/sys-conf", () => ({
  systemConfig: {
    getDataFolder: () => "/tmp",
  },
}));

describe("FsObjectBackend.fetchHash (SHA-256 migration)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fsbackend-hash-test-"));
    inMemoryCache.clear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    inMemoryCache.clear();
    vi.clearAllMocks();
  });

  async function writeObject(id: string, content: Buffer) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const basePath = path.join(tempDir, "objects");
    fs.mkdirSync(basePath, { recursive: true });
    fs.writeFileSync(path.join(basePath, id), content);
    return createHash("sha256").update(content).digest("hex");
  }

  it("computes SHA-256 hash for readable files (not MD5)", async () => {
    const { FsObjectBackend } =
      await import("../../server/internal/objects/fsBackend");
    const content = Buffer.from("hello, drop");
    const expectedHash = await writeObject("test-object", content);
    inMemoryCache.set("test-object", expectedHash);

    const backend = new FsObjectBackend();
    const hash = await backend.fetchHash("test-object");

    expect(hash).toBe(expectedHash);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different content", async () => {
    const { FsObjectBackend } =
      await import("../../server/internal/objects/fsBackend");
    const hashAExpected = await writeObject("obj-a", Buffer.from("content-a"));
    const hashBExpected = await writeObject("obj-b", Buffer.from("content-b"));
    inMemoryCache.set("obj-a", hashAExpected);
    inMemoryCache.set("obj-b", hashBExpected);

    const backend = new FsObjectBackend();
    const hashA = await backend.fetchHash("obj-a");
    const hashB = await backend.fetchHash("obj-b");

    expect(hashA).not.toBe(hashB);
    expect(hashA).toBe(hashAExpected);
    expect(hashB).toBe(hashBExpected);
  });

  it("matches known SHA-256 fixture for 'abc'", async () => {
    const { FsObjectBackend } =
      await import("../../server/internal/objects/fsBackend");
    await writeObject("test-object", Buffer.from("abc"));
    inMemoryCache.set(
      "test-object",
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );

    const backend = new FsObjectBackend();
    const hash = await backend.fetchHash("test-object");

    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("returns undefined for missing objects", async () => {
    const { FsObjectBackend } =
      await import("../../server/internal/objects/fsBackend");
    const fs = await import("node:fs");
    fs.mkdirSync(join(tempDir, "objects"), { recursive: true });

    const backend = new FsObjectBackend();
    const hash = await backend.fetchHash("nonexistent");

    expect(hash).toBeUndefined();
  });
});
