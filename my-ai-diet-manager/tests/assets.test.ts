import { describe, expect, test } from "vitest";
import { serveAsset, __test__ } from "@worker/assets";
import type { Env } from "@worker/env";

const REAL_FILES = new Set(["/index.html", "/assets/app.js", "/assets/app.css", "/icons/icon-192.png"]);

/**
 * Reproduces Cloudflare's own asset-serving fallback: any request for a path that
 * isn't a real file comes back as index.html with status 200, not a 404 - the
 * exact behavior the worker's serveAsset() must correct for non-HTML/unknown routes.
 */
function makeMockAssets(): Env["ASSETS"] {
  return {
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      if (REAL_FILES.has(url.pathname)) {
        const contentType = url.pathname.endsWith(".js")
          ? "application/javascript"
          : url.pathname.endsWith(".css")
            ? "text/css"
            : url.pathname.endsWith(".png")
              ? "image/png"
              : "text/html; charset=utf-8";
        return new Response("real file contents", { status: 200, headers: { "Content-Type": contentType } });
      }
      // SPA fallback: everything else resolves to index.html with a 200.
      return new Response("<html>index</html>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
  } as unknown as Env["ASSETS"];
}

function makeEnv(): Env {
  return { DB: undefined as unknown as Env["DB"], ASSETS: makeMockAssets() };
}

describe("isKnownClientRoute", () => {
  test("accepts the app's static routes", () => {
    expect(__test__.isKnownClientRoute("/today")).toBe(true);
    expect(__test__.isKnownClientRoute("/history")).toBe(true);
    expect(__test__.isKnownClientRoute("/")).toBe(true);
  });

  test("accepts a dynamic meal edit route", () => {
    expect(__test__.isKnownClientRoute("/meals/abc-123/edit")).toBe(true);
  });

  test("rejects an arbitrary unknown path", () => {
    expect(__test__.isKnownClientRoute("/definitely-not-a-page")).toBe(false);
  });
});

describe("serveAsset (correcting Cloudflare's SPA fallback)", () => {
  test("serves a real static file as-is", async () => {
    const res = await serveAsset(makeEnv(), new Request("http://localhost/assets/app.js"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("real file contents");
  });

  test("returns a real 404 for a missing JS asset, not the SPA fallback page", async () => {
    const res = await serveAsset(makeEnv(), new Request("http://localhost/assets/missing.js"));
    expect(res.status).toBe(404);
  });

  test("returns a real 404 for a missing image file", async () => {
    const res = await serveAsset(makeEnv(), new Request("http://localhost/icons/missing.png"));
    expect(res.status).toBe(404);
  });

  test("returns a real 404 for an unknown extensionless path", async () => {
    const res = await serveAsset(makeEnv(), new Request("http://localhost/definitely-not-a-page"));
    expect(res.status).toBe(404);
  });

  test("serves index.html for a known client route with no-cache headers", async () => {
    const res = await serveAsset(makeEnv(), new Request("http://localhost/today"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/no-cache/);
  });

  test("serves the root path", async () => {
    const res = await serveAsset(makeEnv(), new Request("http://localhost/"));
    expect(res.status).toBe(200);
  });
});
