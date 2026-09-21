import type { Env } from "./env";
import { ApiHttpError, jsonError } from "./json";
import { requireAuth } from "./auth";
import { serveAsset } from "./assets";
import { handleHealth } from "./handlers/health";
import { handleLogin, handleLogout, handleSession } from "./handlers/auth";
import { handleGetProfile, handlePutProfile } from "./handlers/profile";
import { handleAnalyzeImage, handleAnalyzeText } from "./handlers/analyze";
import { handleCreateMeal, handleDeleteMeal, handleGetMeal, handleListMeals, handleUpdateMeal } from "./handlers/meals";
import { handleCreateWeight, handleDeleteWeight, handleListWeights, handleUpdateWeight } from "./handlers/weights";
import { handleDashboard } from "./handlers/dashboard";
import { handleProgress } from "./handlers/progress";
import { handleExport } from "./handlers/export";

const MEAL_ID_ROUTE = /^\/api\/meals\/([A-Za-z0-9-]+)$/;
const WEIGHT_ID_ROUTE = /^\/api\/weights\/([A-Za-z0-9-]+)$/;

const PUBLIC_ROUTES = new Set(["GET /api/health", "POST /api/auth/login", "POST /api/auth/logout", "GET /api/auth/session"]);

async function routeApi(env: Env, request: Request, url: URL): Promise<Response> {
  const method = request.method.toUpperCase();
  const pathname = url.pathname;
  const routeKey = `${method} ${pathname}`;

  const mealIdMatch = pathname.match(MEAL_ID_ROUTE);
  const weightIdMatch = pathname.match(WEIGHT_ID_ROUTE);

  const isKnownRoute =
    PUBLIC_ROUTES.has(routeKey) ||
    routeKey === "GET /api/profile" ||
    routeKey === "PUT /api/profile" ||
    routeKey === "POST /api/analyze/text" ||
    routeKey === "POST /api/analyze/image" ||
    routeKey === "GET /api/meals" ||
    routeKey === "POST /api/meals" ||
    routeKey === "GET /api/weights" ||
    routeKey === "POST /api/weights" ||
    routeKey === "GET /api/dashboard" ||
    routeKey === "GET /api/progress" ||
    routeKey === "GET /api/export" ||
    (mealIdMatch && ["GET", "PUT", "DELETE"].includes(method)) ||
    (weightIdMatch && ["PUT", "DELETE"].includes(method));

  // Unknown API routes return 404 before anything else is checked, so a
  // mistyped URL never looks like a missing Cloudflare binding.
  if (!isKnownRoute) {
    return jsonError("NOT_FOUND", "That API route does not exist.", 404);
  }

  if (!PUBLIC_ROUTES.has(routeKey)) {
    await requireAuth(env, request);
  }

  if (routeKey === "GET /api/health") return handleHealth(env);
  if (routeKey === "POST /api/auth/login") return handleLogin(env, request);
  if (routeKey === "POST /api/auth/logout") return handleLogout(env, request);
  if (routeKey === "GET /api/auth/session") return handleSession(env, request);
  if (routeKey === "GET /api/profile") return handleGetProfile(env);
  if (routeKey === "PUT /api/profile") return handlePutProfile(env, request);
  if (routeKey === "POST /api/analyze/text") return handleAnalyzeText(env, request);
  if (routeKey === "POST /api/analyze/image") return handleAnalyzeImage(env, request);
  if (routeKey === "GET /api/meals") return handleListMeals(env, url);
  if (routeKey === "POST /api/meals") return handleCreateMeal(env, request);
  if (routeKey === "GET /api/weights") return handleListWeights(env, url);
  if (routeKey === "POST /api/weights") return handleCreateWeight(env, request);
  if (routeKey === "GET /api/dashboard") return handleDashboard(env, url);
  if (routeKey === "GET /api/progress") return handleProgress(env, url);
  if (routeKey === "GET /api/export") return handleExport(env);

  if (mealIdMatch) {
    const id = mealIdMatch[1];
    if (method === "GET") return handleGetMeal(env, id);
    if (method === "PUT") return handleUpdateMeal(env, id, request);
    if (method === "DELETE") return handleDeleteMeal(env, id);
  }

  if (weightIdMatch) {
    const id = weightIdMatch[1];
    if (method === "PUT") return handleUpdateWeight(env, id, request);
    if (method === "DELETE") return handleDeleteWeight(env, id);
  }

  return jsonError("NOT_FOUND", "That API route does not exist.", 404);
}

function friendlyErrorFor(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof ApiHttpError) {
    return { code: error.code, message: error.message, status: error.status };
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message)) {
    return {
      code: "MISSING_TABLES",
      message: "The database has not been set up yet. Run the schema migration and try again.",
      status: 500
    };
  }
  if (/D1_ERROR|SQLITE/i.test(message)) {
    return { code: "DATABASE_ERROR", message: "We couldn't reach the database. Please try again shortly.", status: 500 };
  }

  return { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", status: 500 };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await routeApi(env, request, url);
      } catch (error) {
        const friendly = friendlyErrorFor(error);
        return jsonError(friendly.code, friendly.message, friendly.status);
      }
    }

    return serveAsset(env, request);
  }
};
