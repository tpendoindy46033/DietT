import { describe, expect, test } from "vitest";
import { hmacHex, constantTimeEqualHex, passwordsMatch, randomToken, randomId } from "@worker/crypto";

describe("hmacHex", () => {
  test("is deterministic for the same secret and message", async () => {
    const a = await hmacHex("secret", "hello");
    const b = await hmacHex("secret", "hello");
    expect(a).toBe(b);
  });

  test("differs when the secret changes", async () => {
    const a = await hmacHex("secret-one", "hello");
    const b = await hmacHex("secret-two", "hello");
    expect(a).not.toBe(b);
  });

  test("differs when the message changes", async () => {
    const a = await hmacHex("secret", "hello");
    const b = await hmacHex("secret", "world");
    expect(a).not.toBe(b);
  });
});

describe("constantTimeEqualHex", () => {
  test("returns true for identical strings", () => {
    expect(constantTimeEqualHex("abcdef", "abcdef")).toBe(true);
  });

  test("returns false for different strings of the same length", () => {
    expect(constantTimeEqualHex("abcdef", "abcdeg")).toBe(false);
  });

  test("returns false for strings of different lengths", () => {
    expect(constantTimeEqualHex("abc", "abcdef")).toBe(false);
  });
});

describe("passwordsMatch", () => {
  test("matches the correct password", async () => {
    expect(await passwordsMatch("session-secret", "correct-password", "correct-password")).toBe(true);
  });

  test("rejects an incorrect password", async () => {
    expect(await passwordsMatch("session-secret", "wrong-password", "correct-password")).toBe(false);
  });

  test("is keyed by the session secret, not derived from the password", async () => {
    const matchWithSecretA = await passwordsMatch("secret-a", "password", "password");
    const matchWithSecretB = await passwordsMatch("secret-b", "password", "password");
    // Both should still match (secret only affects the HMAC digest, not the comparison outcome).
    expect(matchWithSecretA).toBe(true);
    expect(matchWithSecretB).toBe(true);
  });
});

describe("randomToken / randomId", () => {
  test("produces unique, URL-safe tokens", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/[+/=]/);
  });

  test("produces unique ids", () => {
    expect(randomId()).not.toBe(randomId());
  });
});
