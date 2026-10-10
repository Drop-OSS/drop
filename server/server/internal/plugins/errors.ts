/** Raised when a plugin targets an incompatible plugin API version. */
export class PluginApiVersionError extends Error {
  constructor(
    readonly pluginId: string,
    readonly expected: number,
    readonly found: number | undefined,
  ) {
    super(
      `Plugin '${pluginId}' targets plugin API v${found ?? "unspecified"}; ` +
        `this server implements v${expected}`,
    );
    this.name = "PluginApiVersionError";
  }
}

/** Raised when a plugin uses a capability it did not declare. */
export class PluginCapabilityError extends Error {
  constructor(
    readonly pluginId: string,
    readonly capability: string,
    readonly operation: string,
  ) {
    super(
      `Plugin '${pluginId}' attempted '${operation}' without the ` +
        `'${capability}' capability`,
    );
    this.name = "PluginCapabilityError";
  }
}

/** Raised when a plugin requests an unsupported trust tier. */
export class PluginTrustError extends Error {
  constructor(
    readonly pluginId: string,
    readonly trust: string,
  ) {
    super(
      `Plugin '${pluginId}' requested the '${trust}' trust tier, which is not ` +
        `supported by this server`,
    );
    this.name = "PluginTrustError";
  }
}
