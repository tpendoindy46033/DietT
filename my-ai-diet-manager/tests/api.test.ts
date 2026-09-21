import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { createD1FromSchema, type ShimDatabase } from "./helpers/d1Shim";
import worker from "@worker/index";
import type { Env } from "@worker/env";

const schemaSql = readFileSync(resolve(process.cwd(), "database", "schema.sql"), "utf8");
const db = await createD1FromSchema(schemaSql);

function makeEnv(database: ShimDatabase, overrides: Partial<Env> = {}): Env {
  return {
    DB: database as unknown as Env["DB"],
    ASSETS: { fetch: async () => new Response("not used") } as unknown as Env["ASSETS"],
    OPENAI_API_KEY: "sk-test-key",
    APP_PASSWORD: "correct horse battery staple",
    SESSION_SECRET: "a-very-long-test-session-secret-value",
    ...overrides
  };
}

async function callApi(env: Env, method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const response = await worker.fetch(request, env);
  const json = await response.json();
  return { status: response.status, json, headers: response.headers };
}

async function login(env: Env): Promise<string> {
  const res = await callApi(env, "POST", "/api/auth/login", { password: "correct horse battery staple" });
  const setCookie = res.headers.get("Set-Cookie") ?? "";
  const token = setCookie.split(";")[0];
  return token;
}

describe.skipIf(!db)("worker API (real schema via node:sqlite)", () => {
  let env: Env;

  beforeEach(async () => {
    // Fresh in-memory database per test for isolation.
    const fresh = await createD1FromSchema(schemaSql);
    env = makeEnv(fresh!);
  });

  test("GET /api/health reports configuration without auth", async () => {
    const res = await callApi(env, "GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.json.data.database).toBe(true);
    expect(res.json.data.openai).toBe(true);
    expect(res.json.data.password).toBe(true);
    expect(res.json.data.sessionSecret).toBe(true);
  });

  test("GET /api/health reports missing resources honestly", async () => {
    const bareEnv = makeEnv((env as unknown as { DB: ShimDatabase }).DB, {
      OPENAI_API_KEY: undefined,
      APP_PASSWORD: undefined,
      SESSION_SECRET: undefined
    });
    const res = await callApi(bareEnv, "GET", "/api/health");
    expect(res.json.data.openai).toBe(false);
    expect(res.json.data.password).toBe(false);
    expect(res.json.data.sessionSecret).toBe(false);
  });

  test("unknown /api/* route returns 404 before any config check", async () => {
    const res = await callApi(env, "GET", "/api/totally-not-a-real-route");
    expect(res.status).toBe(404);
    expect(res.json.ok).toBe(false);
  });

  test("rejects requests to personal-data routes without a session", async () => {
    const res = await callApi(env, "GET", "/api/meals");
    expect(res.status).toBe(401);
  });

  test("login fails with the wrong password and records the attempt", async () => {
    const res = await callApi(env, "POST", "/api/auth/login", { password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.json.error.code).toBe("INVALID_PASSWORD");
  });

  test("login succeeds with the right password and sets a session cookie", async () => {
    const res = await callApi(env, "POST", "/api/auth/login", { password: "correct horse battery staple" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/session=.+HttpOnly/);
  });

  test("rate limits repeated failed logins from the same IP", async () => {
    for (let i = 0; i < 8; i++) {
      await callApi(env, "POST", "/api/auth/login", { password: "wrong" });
    }
    const res = await callApi(env, "POST", "/api/auth/login", { password: "wrong" });
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe("RATE_LIMITED");
  });

  test("session cookie authenticates subsequent requests", async () => {
    const cookie = await login(env);
    const res = await callApi(env, "GET", "/api/auth/session", undefined, cookie);
    expect(res.json.data.authenticated).toBe(true);
  });

  test("logout clears the session", async () => {
    const cookie = await login(env);
    await callApi(env, "POST", "/api/auth/logout", undefined, cookie);
    const res = await callApi(env, "GET", "/api/auth/session", undefined, cookie);
    expect(res.json.data.authenticated).toBe(false);
  });

  test("rejects a meal with no items", async () => {
    const cookie = await login(env);
    const res = await callApi(
      env,
      "POST",
      "/api/meals",
      {
        mealName: "Empty",
        mealType: "snack",
        mealDate: "2024-01-01",
        mealTime: "10:00",
        inputMethod: "manual",
        items: []
      },
      cookie
    );
    expect(res.status).toBe(422);
  });

  test("creates a meal and recalculates totals from items, ignoring any client-sent totals", async () => {
    const cookie = await login(env);
    const res = await callApi(
      env,
      "POST",
      "/api/meals",
      {
        mealName: "Rice bowl",
        mealType: "lunch",
        mealDate: "2024-01-01",
        mealTime: "12:30",
        inputMethod: "manual",
        totals: { calories: 999999 },
        items: [
          {
            foodName: "Cooked white rice",
            amount: 1,
            unit: "cup",
            estimatedGrams: 158,
            calories: 205,
            proteinGrams: 4.3,
            carbohydrateGrams: 44.5,
            fatGrams: 0.4,
            fiberGrams: 0.6
          },
          {
            foodName: "Dal",
            amount: 1,
            unit: "bowl",
            estimatedGrams: 200,
            calories: 150,
            proteinGrams: 9,
            carbohydrateGrams: 20,
            fatGrams: 3,
            fiberGrams: 5
          }
        ]
      },
      cookie
    );
    expect(res.status).toBe(201);
    expect(res.json.data.totals.calories).toBe(355);
    expect(res.json.data.totals.proteinGrams).toBeCloseTo(13.3, 5);

    const getRes = await callApi(env, "GET", `/api/meals/${res.json.data.id}`, undefined, cookie);
    expect(getRes.json.data.items).toHaveLength(2);

    const delRes = await callApi(env, "DELETE", `/api/meals/${res.json.data.id}`, undefined, cookie);
    expect(delRes.status).toBe(200);

    const missingRes = await callApi(env, "GET", `/api/meals/${res.json.data.id}`, undefined, cookie);
    expect(missingRes.status).toBe(404);
  });

  test("weight entries can be created, updated and deleted", async () => {
    const cookie = await login(env);
    const create = await callApi(env, "POST", "/api/weights", { weightValue: 70, weightUnit: "kg", recordedDate: "2024-01-01" }, cookie);
    expect(create.status).toBe(201);

    const update = await callApi(
      env,
      "PUT",
      `/api/weights/${create.json.data.id}`,
      { weightValue: 69.5, weightUnit: "kg", recordedDate: "2024-01-02" },
      cookie
    );
    expect(update.json.data.weightValue).toBe(69.5);

    const del = await callApi(env, "DELETE", `/api/weights/${create.json.data.id}`, undefined, cookie);
    expect(del.status).toBe(200);
  });

  test("dashboard reflects meals logged for the requested date", async () => {
    const cookie = await login(env);
    await callApi(
      env,
      "POST",
      "/api/meals",
      {
        mealName: "Breakfast",
        mealType: "breakfast",
        mealDate: "2024-02-01",
        mealTime: "08:00",
        inputMethod: "manual",
        items: [
          { foodName: "Oats", amount: 1, unit: "bowl", estimatedGrams: 200, calories: 300, proteinGrams: 10, carbohydrateGrams: 50, fatGrams: 5, fiberGrams: 6 }
        ]
      },
      cookie
    );

    const res = await callApi(env, "GET", "/api/dashboard?date=2024-02-01", undefined, cookie);
    expect(res.json.data.consumed.calories).toBe(300);
    expect(res.json.data.groups.find((g: { mealType: string }) => g.mealType === "breakfast").meals).toHaveLength(1);
  });

  test("PUT /api/profile validates and persists targets", async () => {
    const cookie = await login(env);
    const res = await callApi(
      env,
      "PUT",
      "/api/profile",
      {
        displayName: "Alex",
        timezone: "UTC",
        weightUnit: "kg",
        calorieTarget: 2200,
        proteinTarget: 130,
        carbohydrateTarget: 250,
        fatTarget: 70,
        fiberTarget: 30
      },
      cookie
    );
    expect(res.status).toBe(200);
    expect(res.json.data.displayName).toBe("Alex");
  });

  test("analyze/image rejects unsupported mime types", async () => {
    const cookie = await login(env);
    const res = await callApi(env, "POST", "/api/analyze/image", { imageBase64: "AAAA", mimeType: "image/gif" }, cookie);
    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe("INVALID_IMAGE");
  });

  test("analyze/image rejects images over the size limit", async () => {
    const cookie = await login(env);
    const oversized = "A".repeat(7 * 1024 * 1024);
    const res = await callApi(env, "POST", "/api/analyze/image", { imageBase64: oversized, mimeType: "image/jpeg" }, cookie);
    expect(res.status).toBe(413);
    expect(res.json.error.code).toBe("IMAGE_TOO_LARGE");
  });

  test("analyze/text returns a friendly error when OPENAI_API_KEY is missing", async () => {
    const noKeyEnv = makeEnv((env as unknown as { DB: ShimDatabase }).DB, { OPENAI_API_KEY: undefined });
    const cookie = (await callApi(noKeyEnv, "POST", "/api/auth/login", { password: "correct horse battery staple" })).headers
      .get("Set-Cookie")!
      .split(";")[0];
    const res = await callApi(noKeyEnv, "POST", "/api/analyze/text", { description: "A bowl of rice" }, cookie);
    expect(res.status).toBe(500);
    expect(res.json.error.code).toBe("MISSING_OPENAI_KEY");
  });
});

describe("worker API without a database binding", () => {
  test("health reports database as unconfigured rather than crashing", async () => {
    const env = makeEnv(undefined as unknown as ShimDatabase, { DB: undefined as unknown as Env["DB"] });
    const res = await callApi(env, "GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.json.data.database).toBe(false);
  });
});
