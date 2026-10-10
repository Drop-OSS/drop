import test from "node:test";
import assert from "node:assert/strict";
import {
  applySettingsDefaults,
  mergeSettingsPayload,
  normalizeSettingsSchema,
  redactSettingsValues,
  validateSettingsValues,
} from "../settings";

const schema = {
  fields: [
    { key: "name", label: "Name", type: "string" as const, required: true },
    { key: "token", label: "Token", type: "password" as const },
    { key: "count", label: "Count", type: "number" as const, default: 10 },
    { key: "on", label: "On", type: "boolean" as const },
    {
      key: "mode",
      label: "Mode",
      type: "select" as const,
      options: [
        { label: "A", value: "a" },
        { label: "B", value: { nested: 1 } },
      ],
    },
  ],
};

test("normalizeSettingsSchema accepts valid schemas and rejects malformed ones", () => {
  assert.deepEqual(normalizeSettingsSchema(schema), schema);
  assert.equal(normalizeSettingsSchema(undefined), undefined);
  assert.equal(normalizeSettingsSchema({}), undefined);
  assert.equal(normalizeSettingsSchema({ fields: "no" }), undefined);
  assert.equal(normalizeSettingsSchema({ fields: [{}] }), undefined);
  assert.equal(
    normalizeSettingsSchema({
      fields: [{ key: "x", label: "X", type: "object" }],
    }),
    undefined,
  );
});

test("validateSettingsValues type-checks every field type", () => {
  const ok = validateSettingsValues(schema, {
    name: "drop",
    count: 5,
    on: true,
    mode: { nested: 1 },
  });
  assert.equal(ok.valid, true, ok.errors.join(", "));

  assert.match(
    validateSettingsValues(schema, {
      name: "drop",
      count: Number.NaN,
    }).errors.join(),
    /finite number/,
  );
  assert.match(
    validateSettingsValues(schema, { name: "drop", on: "yes" }).errors.join(),
    /boolean/,
  );
  assert.match(
    validateSettingsValues(schema, { name: "drop", mode: "c" }).errors.join(),
    /declared options/,
  );
  assert.match(
    validateSettingsValues(schema, { name: "drop", extra: 1 }).errors.join(),
    /Unknown setting/,
  );
  assert.match(
    validateSettingsValues(schema, null).errors.join(),
    /must be an object/,
  );
});

test("applySettingsDefaults fills missing fields only", () => {
  assert.deepEqual(applySettingsDefaults(schema, { name: "drop", count: 0 }), {
    name: "drop",
    count: 0,
  });
});

test("mergeSettingsPayload keeps omitted secrets and clears null passwords", () => {
  const stored = { name: "drop", token: "secret" };

  const kept = mergeSettingsPayload(schema, stored, { count: 2 });
  assert.equal(kept.errors.length, 0);
  assert.equal(kept.input.token, "secret");
  assert.equal(kept.input.count, 2);

  const cleared = mergeSettingsPayload(schema, stored, { token: null });
  assert.equal(cleared.errors.length, 0);
  assert.equal(Object.hasOwn(cleared.input, "token"), false);

  const unknown = mergeSettingsPayload(schema, stored, { bogus: 1 });
  assert.match(unknown.errors.join(), /Unknown setting/);
});

test("redactSettingsValues hides passwords and reports presence", () => {
  const { values, secrets } = redactSettingsValues(schema, {
    name: "drop",
    token: "secret",
    count: 3,
  });
  assert.deepEqual(values, { name: "drop", count: 3 });
  assert.deepEqual(secrets, { token: true });

  const empty = redactSettingsValues(schema, { token: "" });
  assert.deepEqual(empty.values, {});
  assert.deepEqual(empty.secrets, { token: false });
});
