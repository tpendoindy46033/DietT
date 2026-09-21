const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/** Computes hex HMAC-SHA256(secret, message). Used for session token hashes, IP hashes, and password comparison. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(signature);
}

/** Constant-time comparison of two equal-shaped hex digests. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still walk a full comparison of fixed length so failure due to length
    // does not return faster than a full match would.
    let mismatch = 1;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const ca = a.charCodeAt(i) || 0;
      const cb = b.charCodeAt(i) || 0;
      mismatch |= ca ^ cb;
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Compares a submitted password against the configured one in constant time, keyed by SESSION_SECRET. */
export async function passwordsMatch(sessionSecret: string, submitted: string, actual: string): Promise<boolean> {
  const [submittedHash, actualHash] = await Promise.all([hmacHex(sessionSecret, submitted), hmacHex(sessionSecret, actual)]);
  return constantTimeEqualHex(submittedHash, actualHash);
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomId(): string {
  return crypto.randomUUID();
}
