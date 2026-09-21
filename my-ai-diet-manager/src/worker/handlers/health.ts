import type { Env } from "../env";
import { isConfigured } from "../env";
import { checkDatabaseHealthy } from "../db";
import { jsonOk } from "../json";

export async function handleHealth(env: Env): Promise<Response> {
  const configured = isConfigured(env);
  const databaseHealthy = configured.database ? await checkDatabaseHealthy(env) : false;

  return jsonOk({
    status: "ok",
    database: databaseHealthy,
    openai: configured.openai,
    password: configured.password,
    sessionSecret: configured.sessionSecret
  });
}
