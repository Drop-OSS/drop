export class SaveConflictError extends Error {
  readonly headVersionId: string | null;

  constructor(headVersionId: string | null) {
    super("Save slot head changed since the client's baseline");
    this.name = "SaveConflictError";
    this.headVersionId = headVersionId;
  }
}

/**
 * Prisma reports a violated unique constraint as P2002. Read structurally so
 * this module stays free of the generated client.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
