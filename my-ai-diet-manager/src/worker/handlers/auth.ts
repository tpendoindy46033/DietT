import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import {
  checkRateLimit,
  clearSessionCookieHeader,
  createSession,
  destroySession,
  getAuthenticatedSession,
  getSessionTokenFromRequest,
  recordLoginAttempt,
  sessionCookieHeader,
  verifyPassword
} from "../auth";
import { getProfile } from "../db";

interface LoginBody {
  password?: unknown;
}

export async function handleLogin(env: Env, request: Request): Promise<Response> {
  if (!env.APP_PASSWORD || !env.SESSION_SECRET) {
    throw new ApiHttpError("NOT_CONFIGURED", "The server is not configured for login yet. The administrator needs to set APP_PASSWORD and SESSION_SECRET.", 500);
  }

  await checkRateLimit(env, request);

  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    throw new ApiHttpError("INVALID_BODY", "A password is required.", 400);
  }

  const matches = await verifyPassword(env, password);
  await recordLoginAttempt(env, request, matches);

  if (!matches) {
    throw new ApiHttpError("INVALID_PASSWORD", "Incorrect password. Please try again.", 401);
  }

  const { token, maxAgeSeconds } = await createSession(env);
  return jsonOk({ authenticated: true }, { headers: { "Set-Cookie": sessionCookieHeader(token, maxAgeSeconds) } });
}

export async function handleLogout(env: Env, request: Request): Promise<Response> {
  const token = getSessionTokenFromRequest(request);
  await destroySession(env, token);
  return jsonOk({ authenticated: false }, { headers: { "Set-Cookie": clearSessionCookieHeader() } });
}

export async function handleSession(env: Env, request: Request): Promise<Response> {
  const authenticated = await getAuthenticatedSession(env, request);
  if (!authenticated) {
    return jsonOk({ authenticated: false });
  }
  const profile = await getProfile(env);
  return jsonOk({ authenticated: true, displayName: profile.displayName });
}
