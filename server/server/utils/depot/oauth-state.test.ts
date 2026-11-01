import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeOAuthState, createOAuthState } from "./oauth-state";

test("an OAuth state verifies once, for its own provider", () => {
  const state = createOAuthState("gog");
  assert.equal(consumeOAuthState(state, "epic"), false);
  assert.equal(consumeOAuthState(state, "gog"), true);
  assert.equal(consumeOAuthState(state, "gog"), false, "single use only");
});

test("unknown states never verify", () => {
  assert.equal(consumeOAuthState("not-a-real-state", "gog"), false);
});
