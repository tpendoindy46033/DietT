import type { Env } from "../env";
import { getProfile, listMeals, listWeights } from "../db";

export async function handleExport(env: Env): Promise<Response> {
  const [profile, meals, weights] = await Promise.all([getProfile(env), listMeals(env, {}), listWeights(env)]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    meals,
    weights
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=diet-manager-export.json"
    }
  });
}
