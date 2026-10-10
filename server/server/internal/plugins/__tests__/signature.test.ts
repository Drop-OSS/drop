import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { SIGNATURE_VERSION, signaturePayloadV2 } from "../signature";

/**
 * Shared cross-repo fixture vector. The same values are asserted by the plugin
 * CLI's signer tests (`@drop-oss/plugin-cli`); changing the canonicalization or
 * the payload layout on either side breaks this test.
 */
const FIXTURE = {
  files: [
    ["index.js", 'console.log("hi");\n'],
    ["lib/a.js", "export const a = 1;\n"],
  ] as const,
  key: "fixture-signing-key",
  filesAggregate:
    "771113dd35bd8e72a5dbf35d13f1c535159efddbf5c3ba85d7fff35578a028d3",
  payload: "34f3b3cc692f9fb16c1a7a5bcffb5d4da42d59f79dc1c82829933f26a0dc4e25",
  signature: "3f21422b93a9ca2f852cf9351b628a6c80a7a505b4989dfb72ab80ed88875a96",
};

test("v2 signature payload matches the cross-repo fixture vector", () => {
  const aggregate = createHash("sha256");
  const fileChecksums: Record<string, string> = {};
  for (const [rel, content] of FIXTURE.files) {
    const bytes = Buffer.from(content);
    fileChecksums[rel] = createHash("sha256").update(bytes).digest("hex");
    aggregate.update(rel);
    aggregate.update("\0");
    aggregate.update(String(bytes.length));
    aggregate.update("\0");
    aggregate.update(bytes);
  }
  const filesAggregate = aggregate.digest("hex");
  assert.equal(filesAggregate, FIXTURE.filesAggregate);

  const manifest = {
    id: "fixture",
    name: "Fixture",
    version: "1.0.0",
    apiVersion: 2,
    entry: "index.js",
    capabilities: ["events"],
    checksum: fileChecksums["index.js"],
    files: fileChecksums,
    signatureVersion: SIGNATURE_VERSION,
  };
  const payload = signaturePayloadV2(
    filesAggregate,
    manifest as unknown as Record<string, unknown>,
  );
  assert.equal(payload, FIXTURE.payload);

  const signature = createHmac("sha256", FIXTURE.key)
    .update(payload)
    .digest("hex");
  assert.equal(signature, FIXTURE.signature);
});

test("v2 payload excludes only the signature field", () => {
  const base = { id: "p", version: "1.0.0", signature: "aa", extra: true };
  const withoutSignature = { id: "p", version: "1.0.0", extra: true };
  assert.equal(
    signaturePayloadV2("abc", base as Record<string, unknown>),
    signaturePayloadV2("abc", withoutSignature as Record<string, unknown>),
  );
});
