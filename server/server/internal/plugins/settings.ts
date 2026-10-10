import type { PluginSettingsField, PluginSettingsSchema } from "./types";

/**
 * Reserved storage key under which the host persists values for a plugin's
 * declarative `settingsSchema`. Plugins can read the same values from
 * `PluginContext.settings` at init; the key is namespaced per plugin by
 * `PluginStorage`, so it never collides across plugins.
 */
export const PLUGIN_SETTINGS_STORAGE_KEY = "__drop_settings_v1";

const MAX_SETTINGS_KEYS = 128;
const MAX_STRING_LENGTH = 100_000;
const FIELD_TYPES: ReadonlySet<string> = new Set([
  "string",
  "password",
  "number",
  "boolean",
  "select",
]);

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  values: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate an untrusted schema from an installed manifest into the typed
 * contract, dropping anything malformed. Returns `undefined` when the shape is
 * unusable so callers treat it as "no settings".
 */
export function normalizeSettingsSchema(
  raw: unknown,
): PluginSettingsSchema | undefined {
  if (!isPlainObject(raw)) return undefined;
  const { fields } = raw;
  if (!Array.isArray(fields)) return undefined;
  const normalized: PluginSettingsField[] = [];
  for (const field of fields) {
    if (!isPlainObject(field)) return undefined;
    if (typeof field.key !== "string" || field.key.length === 0)
      return undefined;
    if (typeof field.label !== "string") return undefined;
    if (typeof field.type !== "string" || !FIELD_TYPES.has(field.type)) {
      return undefined;
    }
    if (field.required !== undefined && typeof field.required !== "boolean") {
      return undefined;
    }
    normalized.push(field as unknown as PluginSettingsField);
  }
  return { fields: normalized };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => valuesEqual(a[key], b[key]));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((value, index) => valuesEqual(value, b[index]))
    );
  }
  return false;
}

function validateField(
  field: PluginSettingsField,
  value: unknown,
): { ok: true } | { ok: false; error: string } {
  switch (field.type) {
    case "string":
    case "password":
      if (typeof value !== "string") {
        return { ok: false, error: `Setting '${field.key}' must be a string` };
      }
      if (value.length > MAX_STRING_LENGTH) {
        return { ok: false, error: `Setting '${field.key}' is too long` };
      }
      return { ok: true };
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return {
          ok: false,
          error: `Setting '${field.key}' must be a finite number`,
        };
      }
      return { ok: true };
    case "boolean":
      if (typeof value !== "boolean") {
        return { ok: false, error: `Setting '${field.key}' must be a boolean` };
      }
      return { ok: true };
    case "select": {
      const options = field.options ?? [];
      if (!options.some((option) => valuesEqual(option.value, value))) {
        return {
          ok: false,
          error: `Setting '${field.key}' must be one of the declared options`,
        };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: `Setting '${field.key}' has an unknown type` };
  }
}

/**
 * Validate submitted values against a schema. Unknown keys are rejected
 * (fail-closed) and every declared field is type/option checked. `required`
 * fields must be present with a non-empty value.
 */
export function validateSettingsValues(
  schema: PluginSettingsSchema,
  input: unknown,
): SettingsValidationResult {
  const errors: string[] = [];
  const values: Record<string, unknown> = {};
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: ["Settings payload must be an object"],
      values,
    };
  }
  const keys = Object.keys(input);
  if (keys.length > MAX_SETTINGS_KEYS) {
    return {
      valid: false,
      errors: [`Too many settings keys (max ${MAX_SETTINGS_KEYS})`],
      values,
    };
  }

  const declared = new Map(schema.fields.map((field) => [field.key, field]));
  for (const [key, value] of Object.entries(input)) {
    const field = declared.get(key);
    if (!field) {
      errors.push(`Unknown setting '${key}'`);
      continue;
    }
    const result = validateField(field, value);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    values[key] = value;
  }

  for (const field of schema.fields) {
    if (!field.required) continue;
    const value = values[field.key];
    if (value === undefined || value === "") {
      errors.push(`Setting '${field.key}' is required`);
    }
  }

  return { valid: errors.length === 0, errors, values };
}

/**
 * Apply a partial update over the stored settings. Unknown keys are rejected;
 * `null` for a `password` field clears the stored secret; omitted fields keep
 * their stored value. The merged object is then type/`required` validated by
 * {@link validateSettingsValues}.
 */
export function mergeSettingsPayload(
  schema: PluginSettingsSchema,
  stored: Record<string, unknown>,
  submitted: unknown,
): { input: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const input: Record<string, unknown> = { ...stored };
  if (!isPlainObject(submitted)) {
    return { input, errors: ["Settings payload must be an object"] };
  }
  const declared = new Map(schema.fields.map((field) => [field.key, field]));
  for (const [key, value] of Object.entries(submitted)) {
    const field = declared.get(key);
    if (!field) {
      errors.push(`Unknown setting '${key}'`);
      continue;
    }
    if (field.type === "password" && value === null) {
      Reflect.deleteProperty(input, key);
      continue;
    }
    input[key] = value;
  }
  return { input, errors };
}

/** Merge stored values with schema defaults for fields never persisted. */
export function applySettingsDefaults(
  schema: PluginSettingsSchema,
  stored: unknown,
): Record<string, unknown> {
  const source = isPlainObject(stored) ? stored : {};
  const values: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (Object.hasOwn(source, field.key)) {
      values[field.key] = source[field.key];
    } else if (field.default !== undefined) {
      values[field.key] = field.default;
    }
  }
  return values;
}

/**
 * Replace `password` values with `null` before returning settings over an API
 * boundary. `hasValue` records whether a secret was set without revealing it.
 */
export function redactSettingsValues(
  schema: PluginSettingsSchema,
  values: Record<string, unknown>,
): { values: Record<string, unknown>; secrets: Record<string, boolean> } {
  const redacted: Record<string, unknown> = {};
  const secrets: Record<string, boolean> = {};
  for (const field of schema.fields) {
    if (field.type === "password") {
      secrets[field.key] =
        Object.hasOwn(values, field.key) &&
        values[field.key] !== undefined &&
        values[field.key] !== "";
      continue;
    }
    if (Object.hasOwn(values, field.key)) {
      redacted[field.key] = values[field.key];
    }
  }
  return { values: redacted, secrets };
}
