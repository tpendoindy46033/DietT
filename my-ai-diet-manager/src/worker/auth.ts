import type { Env } from "./env";
import { hmacHex, passwordsMatch, randomId, randomToken } from "./crypto";
import { ApiHttpError } from "./json";

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 8;

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function sessionCookieHeader(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function hashIp(sessionSecret: string, ip: string): Promise<string> {
  return hmacHex(sessionSecret, `ip:${ip}`);
}

export function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";
}

export async function checkRateLimit(env: Env, request: Request): Promise<void> {
  if (!env.SESSION_SECRET) return;
  const ip = getClientIp(request);
  const ipHash = await hashIp(env.SESSION_SECRET, ip);
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const result = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM login_attempts WHERE ip_hash = ? AND attempted_at > ? AND successful = 0"
  )
    .bind(ipHash, windowStart)
    .first<{ count: number }>();

  if (result && result.count >= MAX_ATTEMPTS_PER_WINDOW) {
    throw new ApiHttpError("RATE_LIMITED", "Too many login attempts. Please wait a few minutes and try again.", 429);
  }
}

export async function recordLoginAttempt(env: Env, request: Request, successful: boolean): Promise<void> {
  if (!env.SESSION_SECRET) return;
  const ip = getClientIp(request);
  const ipHash = await hashIp(env.SESSION_SECRET, ip);
  await env.DB.prepare("INSERT INTO login_attempts (ip_hash, successful) VALUES (?, ?)").bind(ipHash, successful ? 1 : 0).run();
}

export async function verifyPassword(env: Env, submitted: string): Promise<boolean> {
  if (!env.SESSION_SECRET || !env.APP_PASSWORD) return false;
  return passwordsMatch(env.SESSION_SECRET, submitted, env.APP_PASSWORD);
}

export async function createSession(env: Env): Promise<{ token: string; maxAgeSeconds: number }> {
  if (!env.SESSION_SECRET) {
    throw new ApiHttpError("MISSING_SESSION_SECRET", "The server is not configured with a session secret yet.", 500);
  }
  const token = randomToken(32);
  const tokenHash = await hmacHex(env.SESSION_SECRET, token);
  const id = randomId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await env.DB.prepare("INSERT INTO sessions (id, token_hash, expires_at) VALUES (?, ?, ?)").bind(id, tokenHash, expiresAt).run();

  return { token, maxAgeSeconds: Math.floor(SESSION_DURATION_MS / 1000) };
}

export async function destroySession(env: Env, token: string | undefined): Promise<void> {
  if (!token || !env.SESSION_SECRET) return;
  const tokenHash = await hmacHex(env.SESSION_SECRET, token);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function getAuthenticatedSession(env: Env, request: Request): Promise<boolean> {
  if (!env.SESSION_SECRET) return false;
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;

  const tokenHash = await hmacHex(env.SESSION_SECRET, token);
  const now = new Date().toISOString();
  const session = await env.DB.prepare("SELECT id, expires_at FROM sessions WHERE token_hash = ?").bind(tokenHash).first<{
    id: string;
    expires_at: string;
  }>();

  if (!session) return false;
  if (session.expires_at <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.id).run();
    return false;
  }

  await env.DB.prepare("UPDATE sessions SET last_used_at = ? WHERE id = ?").bind(now, session.id).run();
  return true;
}

export function getSessionTokenFromRequest(request: Request): string | undefined {
  return parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
}

export async function requireAuth(env: Env, request: Request): Promise<void> {
  const authenticated = await getAuthenticatedSession(env, request);
  if (!authenticated) {
    throw new ApiHttpError("SESSION_EXPIRED", "Your session has expired. Please log in again.", 401);
  }
}
