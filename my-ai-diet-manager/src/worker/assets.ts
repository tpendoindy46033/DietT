import type { Env } from "./env";

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

/** Static client routes the React app actually renders. */
const KNOWN_STATIC_ROUTES = new Set(["/", "/login", "/today", "/add-meal", "/history", "/progress", "/settings"]);

/** Dynamic client routes, e.g. reviewing or editing a specific saved meal. */
const KNOWN_DYNAMIC_ROUTE_PATTERNS = [/^\/meals\/[A-Za-z0-9-]+$/, /^\/meals\/[A-Za-z0-9-]+\/edit$/];

export function isKnownClientRoute(pathname: string): boolean {
  if (KNOWN_STATIC_ROUTES.has(pathname)) return true;
  return KNOWN_DYNAMIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Serves a request through env.ASSETS, correcting for Cloudflare's own SPA
 * fallback: a request for a genuinely missing non-HTML file, or for an
 * extensionless path that isn't one of the app's own routes, comes back as
 * index.html with status 200, not 404. Only real client routes may resolve
 * that way; everything else must be a real 404.
 */
export async function serveAsset(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const assetResponse = await env.ASSETS.fetch(request);

  const contentType = assetResponse.headers.get("Content-Type") ?? "";
  const isHtmlResponse = contentType.includes("text/html");

  if (isHtmlResponse) {
    const requestedAsFile = hasFileExtension(url.pathname) && !url.pathname.endsWith(".html");
    if (requestedAsFile || !isKnownClientRoute(url.pathname)) {
      return notFound();
    }

    // Every HTML document must never be cached, so a stale index.html never
    // keeps pointing at a previous deployment's hashed asset bundle.
    const headers = new Headers(assetResponse.headers);
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    return new Response(assetResponse.body, { status: assetResponse.status, headers });
  }

  return assetResponse;
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const __test__ = { hasFileExtension, isKnownClientRoute };
