/**
 * Integration tests for password hashing utilities.
 *
 * Exercises the actual argon2 / bcrypt hash and verify roundtrip. These
 * functions are the cryptographic core of the simple signin flow —
 * any bug here means users can or cannot sign in.
 */
import { describe, it, expect } from "vitest";
import {
  createHashArgon2,
  checkHashArgon2,
  checkHashBcrypt,
} from "../../server/internal/auth/passwordHash";

describe("passwordHash", () => {
  describe("argon2", () => {
    it("verify succeeds for correct password", async () => {
      const hash = await createHashArgon2("correct-horse-battery-staple");
      await expect(
        checkHashArgon2("correct-horse-battery-staple", hash),
      ).resolves.toBe(true);
    });

    it("verify fails for wrong password", async () => {
      const hash = await createHashArgon2("correct-password");
      await expect(checkHashArgon2("wrong-password", hash)).resolves.toBe(
        false,
      );
    });

    it("verify handles empty password rejection", async () => {
      const hash = await createHashArgon2("non-empty");
      await expect(checkHashArgon2("", hash)).resolves.toBe(false);
    });

    it("two hashes of the same password differ (salt randomness)", async () => {
      const password = "same-password";
      const hash1 = await createHashArgon2(password);
      const hash2 = await createHashArgon2(password);
      expect(hash1).not.toBe(hash2);
      // Both still verify.
      await expect(checkHashArgon2(password, hash1)).resolves.toBe(true);
      await expect(checkHashArgon2(password, hash2)).resolves.toBe(true);
    });
  });

  describe("bcrypt (legacy)", () => {
    it("verify succeeds for correct password", async () => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("correct-password", 10);
      await expect(checkHashBcrypt("correct-password", hash)).resolves.toBe(
        true,
      );
    });

    it("verify fails for wrong password", async () => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("correct-password", 10);
      await expect(checkHashBcrypt("wrong-password", hash)).resolves.toBe(
        false,
      );
    });
  });
});
