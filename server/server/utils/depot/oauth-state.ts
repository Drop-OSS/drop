import { randomUUID } from "node:crypto";

const TEN_MINUTES = 10 * 60 * 1000;

type Pending = { provider: string; expires: number };

/**
 * CSRF state for the browser sign-in flows. Kept in process memory on
 * purpose: a sign-in completes in seconds and a restart simply invalidates
 * unfinished flows - the caller can always press the button again.
 */
const pending = new Map<string, Pending>();

export function createOAuthState(provider: string): string {
  for (const [state, entry] of pending)
    if (entry.expires < Date.now()) pending.delete(state);
  const state = randomUUID();
  pending.set(state, { provider, expires: Date.now() + TEN_MINUTES });
  return state;
}

/** Single-use: a state verifies once, and only for its provider. */
export function consumeOAuthState(state: string, provider: string): boolean {
  const entry = pending.get(state);
  if (!entry || entry.provider !== provider || entry.expires < Date.now())
    return false;
  pending.delete(state);
  return true;
}
