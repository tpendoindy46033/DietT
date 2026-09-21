import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import { createWeight, deleteWeight, listWeights, updateWeight } from "../db";
import { validateWeightInput } from "@shared/validation";

export async function handleListWeights(env: Env, url: URL): Promise<Response> {
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const weights = await listWeights(env, from, to);
  return jsonOk({ weights });
}

export async function handleCreateWeight(env: Env, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const validation = validateWeightInput(body);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("VALIDATION_ERROR", validation.errors.join(" "), 422);
  }

  const weight = await createWeight(env, validation.value);
  return jsonOk(weight, { status: 201 });
}

export async function handleUpdateWeight(env: Env, id: string, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const validation = validateWeightInput(body);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("VALIDATION_ERROR", validation.errors.join(" "), 422);
  }

  const weight = await updateWeight(env, id, validation.value);
  if (!weight) throw new ApiHttpError("NOT_FOUND", "That weight entry could not be found.", 404);
  return jsonOk(weight);
}

export async function handleDeleteWeight(env: Env, id: string): Promise<Response> {
  const deleted = await deleteWeight(env, id);
  if (!deleted) throw new ApiHttpError("NOT_FOUND", "That weight entry could not be found.", 404);
  return jsonOk({ deleted: true });
}
