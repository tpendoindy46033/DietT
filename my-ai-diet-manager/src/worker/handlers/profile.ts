import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import { getProfile, updateProfile } from "../db";
import { validateProfileInput } from "@shared/validation";

export async function handleGetProfile(env: Env): Promise<Response> {
  return jsonOk(await getProfile(env));
}

export async function handlePutProfile(env: Env, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const validation = validateProfileInput(body);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("VALIDATION_ERROR", validation.errors.join(" "), 422);
  }

  return jsonOk(await updateProfile(env, validation.value));
}
