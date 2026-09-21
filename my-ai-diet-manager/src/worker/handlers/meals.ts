import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import { createMeal, deleteMeal, getMeal, listMeals, updateMeal } from "../db";
import { validateMealInput, MEAL_TYPES } from "@shared/validation";
import type { MealType } from "@shared/types";

export async function handleListMeals(env: Env, url: URL): Promise<Response> {
  const date = url.searchParams.get("date") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const mealTypeParam = url.searchParams.get("mealType") ?? undefined;
  const search = url.searchParams.get("q") ?? undefined;

  const mealType = mealTypeParam && MEAL_TYPES.includes(mealTypeParam as MealType) ? (mealTypeParam as MealType) : undefined;

  const meals = await listMeals(env, { date, from, to, mealType, search });
  return jsonOk({ meals });
}

export async function handleGetMeal(env: Env, id: string): Promise<Response> {
  const meal = await getMeal(env, id);
  if (!meal) throw new ApiHttpError("NOT_FOUND", "That meal could not be found.", 404);
  return jsonOk(meal);
}

export async function handleCreateMeal(env: Env, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const validation = validateMealInput(body);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("VALIDATION_ERROR", validation.errors.join(" "), 422);
  }

  const meal = await createMeal(env, validation.value);
  return jsonOk(meal, { status: 201 });
}

export async function handleUpdateMeal(env: Env, id: string, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const validation = validateMealInput(body);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("VALIDATION_ERROR", validation.errors.join(" "), 422);
  }

  const meal = await updateMeal(env, id, validation.value);
  if (!meal) throw new ApiHttpError("NOT_FOUND", "That meal could not be found.", 404);
  return jsonOk(meal);
}

export async function handleDeleteMeal(env: Env, id: string): Promise<Response> {
  const deleted = await deleteMeal(env, id);
  if (!deleted) throw new ApiHttpError("NOT_FOUND", "That meal could not be found.", 404);
  return jsonOk({ deleted: true });
}
