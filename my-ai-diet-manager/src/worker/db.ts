import type { Env } from "./env";
import { randomId } from "./crypto";
import { calculateTotals } from "@shared/nutrition";
import type { Meal, MealItem, MealType, Profile, WeightEntry, WeightUnit } from "@shared/types";
import type { MealInput, MealItemInput, ProfileInput, WeightInput } from "@shared/validation";

const PROFILE_ID = 1;

interface ProfileRow {
  display_name: string;
  timezone: string;
  weight_unit: WeightUnit;
  calorie_target: number;
  protein_target: number;
  carbohydrate_target: number;
  fat_target: number;
  fiber_target: number;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    displayName: row.display_name,
    timezone: row.timezone,
    weightUnit: row.weight_unit,
    calorieTarget: row.calorie_target,
    proteinTarget: row.protein_target,
    carbohydrateTarget: row.carbohydrate_target,
    fatTarget: row.fat_target,
    fiberTarget: row.fiber_target
  };
}

export async function getProfile(env: Env): Promise<Profile> {
  const row = await env.DB.prepare(
    "SELECT display_name, timezone, weight_unit, calorie_target, protein_target, carbohydrate_target, fat_target, fiber_target FROM profiles WHERE id = ?"
  )
    .bind(PROFILE_ID)
    .first<ProfileRow>();

  if (!row) {
    return {
      displayName: "Me",
      timezone: "UTC",
      weightUnit: "kg",
      calorieTarget: 2000,
      proteinTarget: 100,
      carbohydrateTarget: 250,
      fatTarget: 70,
      fiberTarget: 30
    };
  }
  return mapProfile(row);
}

export async function updateProfile(env: Env, input: ProfileInput): Promise<Profile> {
  await env.DB.prepare(
    `UPDATE profiles SET display_name = ?, timezone = ?, weight_unit = ?, calorie_target = ?, protein_target = ?,
     carbohydrate_target = ?, fat_target = ?, fiber_target = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  )
    .bind(
      input.displayName,
      input.timezone,
      input.weightUnit,
      input.calorieTarget,
      input.proteinTarget,
      input.carbohydrateTarget,
      input.fatTarget,
      input.fiberTarget,
      PROFILE_ID
    )
    .run();
  return getProfile(env);
}

interface MealRow {
  id: string;
  meal_name: string;
  meal_type: MealType;
  meal_date: string;
  meal_time: string;
  input_method: "text" | "photo" | "manual";
  original_text: string | null;
  notes: string | null;
  ai_model: string | null;
  overall_confidence: number | null;
  created_at: string;
  updated_at: string;
}

interface MealItemRow {
  id: string;
  meal_id: string;
  food_name: string;
  amount: number;
  unit: string;
  estimated_grams: number;
  calories: number;
  protein_grams: number;
  carbohydrate_grams: number;
  fat_grams: number;
  fiber_grams: number;
  preparation: string | null;
  confidence: number | null;
  assumptions: string | null;
  nutrition_source: string;
}

function mapMealItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    foodName: row.food_name,
    amount: row.amount,
    unit: row.unit,
    estimatedGrams: row.estimated_grams,
    calories: row.calories,
    proteinGrams: row.protein_grams,
    carbohydrateGrams: row.carbohydrate_grams,
    fatGrams: row.fat_grams,
    fiberGrams: row.fiber_grams,
    preparation: row.preparation,
    confidence: row.confidence,
    assumptions: row.assumptions,
    nutritionSource: row.nutrition_source
  };
}

function mapMeal(row: MealRow, items: MealItem[]): Meal {
  return {
    id: row.id,
    mealName: row.meal_name,
    mealType: row.meal_type,
    mealDate: row.meal_date,
    mealTime: row.meal_time,
    inputMethod: row.input_method,
    originalText: row.original_text,
    notes: row.notes,
    aiModel: row.ai_model,
    overallConfidence: row.overall_confidence,
    items,
    totals: calculateTotals(items),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function fetchItemsForMeals(env: Env, mealIds: string[]): Promise<Map<string, MealItem[]>> {
  const map = new Map<string, MealItem[]>();
  if (mealIds.length === 0) return map;
  const placeholders = mealIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT id, meal_id, food_name, amount, unit, estimated_grams, calories, protein_grams, carbohydrate_grams,
      fat_grams, fiber_grams, preparation, confidence, assumptions, nutrition_source
     FROM meal_items WHERE meal_id IN (${placeholders}) ORDER BY rowid ASC`
  )
    .bind(...mealIds)
    .all<MealItemRow>();

  for (const row of results) {
    const list = map.get(row.meal_id) ?? [];
    list.push(mapMealItem(row));
    map.set(row.meal_id, list);
  }
  return map;
}

export interface MealFilters {
  date?: string;
  from?: string;
  to?: string;
  mealType?: MealType;
  search?: string;
  limit?: number;
}

export async function listMeals(env: Env, filters: MealFilters): Promise<Meal[]> {
  const conditions: string[] = ["profile_id = ?"];
  const params: unknown[] = [PROFILE_ID];

  if (filters.date) {
    conditions.push("meal_date = ?");
    params.push(filters.date);
  }
  if (filters.from) {
    conditions.push("meal_date >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("meal_date <= ?");
    params.push(filters.to);
  }
  if (filters.mealType) {
    conditions.push("meal_type = ?");
    params.push(filters.mealType);
  }
  if (filters.search) {
    conditions.push(
      "(meal_name LIKE ? OR id IN (SELECT meal_id FROM meal_items WHERE food_name LIKE ?))"
    );
    const like = `%${filters.search}%`;
    params.push(like, like);
  }

  const limit = filters.limit ?? 500;
  const { results } = await env.DB.prepare(
    `SELECT * FROM meals WHERE ${conditions.join(" AND ")} ORDER BY meal_date DESC, meal_time DESC LIMIT ?`
  )
    .bind(...params, limit)
    .all<MealRow>();

  const itemsByMeal = await fetchItemsForMeals(env, results.map((r) => r.id));
  return results.map((row) => mapMeal(row, itemsByMeal.get(row.id) ?? []));
}

export async function getMeal(env: Env, id: string): Promise<Meal | null> {
  const row = await env.DB.prepare("SELECT * FROM meals WHERE id = ? AND profile_id = ?").bind(id, PROFILE_ID).first<MealRow>();
  if (!row) return null;
  const itemsByMeal = await fetchItemsForMeals(env, [id]);
  return mapMeal(row, itemsByMeal.get(id) ?? []);
}

function buildItemStatements(env: Env, mealId: string, items: MealItemInput[]) {
  return items.map((item) =>
    env.DB.prepare(
      `INSERT INTO meal_items (id, meal_id, food_name, amount, unit, estimated_grams, calories, protein_grams,
        carbohydrate_grams, fat_grams, fiber_grams, preparation, confidence, assumptions, nutrition_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      randomId(),
      mealId,
      item.foodName,
      item.amount,
      item.unit,
      item.estimatedGrams,
      item.calories,
      item.proteinGrams,
      item.carbohydrateGrams,
      item.fatGrams,
      item.fiberGrams,
      item.preparation ?? null,
      item.confidence ?? null,
      item.assumptions ?? null,
      "gpt-5-nano-estimate"
    )
  );
}

export async function createMeal(env: Env, input: MealInput): Promise<Meal> {
  const id = randomId();
  const insertMeal = env.DB.prepare(
    `INSERT INTO meals (id, profile_id, meal_name, meal_type, meal_date, meal_time, input_method, original_text,
      notes, ai_model, overall_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    PROFILE_ID,
    input.mealName,
    input.mealType,
    input.mealDate,
    input.mealTime,
    input.inputMethod,
    input.originalText ?? null,
    input.notes ?? null,
    input.aiModel ?? null,
    input.overallConfidence ?? null
  );

  await env.DB.batch([insertMeal, ...buildItemStatements(env, id, input.items)]);

  const meal = await getMeal(env, id);
  if (!meal) throw new Error("Failed to load meal after creation");
  return meal;
}

export async function updateMeal(env: Env, id: string, input: MealInput): Promise<Meal | null> {
  const existing = await getMeal(env, id);
  if (!existing) return null;

  const updateMealStmt = env.DB.prepare(
    `UPDATE meals SET meal_name = ?, meal_type = ?, meal_date = ?, meal_time = ?, notes = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND profile_id = ?`
  ).bind(input.mealName, input.mealType, input.mealDate, input.mealTime, input.notes ?? null, id, PROFILE_ID);

  const deleteItemsStmt = env.DB.prepare("DELETE FROM meal_items WHERE meal_id = ?").bind(id);

  await env.DB.batch([updateMealStmt, deleteItemsStmt, ...buildItemStatements(env, id, input.items)]);

  return getMeal(env, id);
}

export async function deleteMeal(env: Env, id: string): Promise<boolean> {
  const deleteItemsStmt = env.DB.prepare("DELETE FROM meal_items WHERE meal_id = ?").bind(id);
  const deleteMealStmt = env.DB.prepare("DELETE FROM meals WHERE id = ? AND profile_id = ?").bind(id, PROFILE_ID);
  const result = await env.DB.batch([deleteItemsStmt, deleteMealStmt]);
  const mealResult = result[1];
  return (mealResult.meta.changes ?? 0) > 0;
}

interface WeightRow {
  id: string;
  weight_value: number;
  weight_unit: WeightUnit;
  recorded_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapWeight(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    weightValue: row.weight_value,
    weightUnit: row.weight_unit,
    recordedDate: row.recorded_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listWeights(env: Env, from?: string, to?: string): Promise<WeightEntry[]> {
  const conditions = ["profile_id = ?"];
  const params: unknown[] = [PROFILE_ID];
  if (from) {
    conditions.push("recorded_date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("recorded_date <= ?");
    params.push(to);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM weights WHERE ${conditions.join(" AND ")} ORDER BY recorded_date DESC`
  )
    .bind(...params)
    .all<WeightRow>();
  return results.map(mapWeight);
}

export async function getLatestWeight(env: Env): Promise<WeightEntry | null> {
  const row = await env.DB.prepare("SELECT * FROM weights WHERE profile_id = ? ORDER BY recorded_date DESC, created_at DESC LIMIT 1")
    .bind(PROFILE_ID)
    .first<WeightRow>();
  return row ? mapWeight(row) : null;
}

export async function createWeight(env: Env, input: WeightInput): Promise<WeightEntry> {
  const id = randomId();
  await env.DB.prepare(
    "INSERT INTO weights (id, profile_id, weight_value, weight_unit, recorded_date, notes) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, PROFILE_ID, input.weightValue, input.weightUnit, input.recordedDate, input.notes ?? null)
    .run();
  const row = await env.DB.prepare("SELECT * FROM weights WHERE id = ?").bind(id).first<WeightRow>();
  return mapWeight(row!);
}

export async function updateWeight(env: Env, id: string, input: WeightInput): Promise<WeightEntry | null> {
  const result = await env.DB.prepare(
    `UPDATE weights SET weight_value = ?, weight_unit = ?, recorded_date = ?, notes = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND profile_id = ?`
  )
    .bind(input.weightValue, input.weightUnit, input.recordedDate, input.notes ?? null, id, PROFILE_ID)
    .run();
  if ((result.meta.changes ?? 0) === 0) return null;
  const row = await env.DB.prepare("SELECT * FROM weights WHERE id = ?").bind(id).first<WeightRow>();
  return row ? mapWeight(row) : null;
}

export async function deleteWeight(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM weights WHERE id = ? AND profile_id = ?").bind(id, PROFILE_ID).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function checkDatabaseHealthy(env: Env): Promise<boolean> {
  try {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('profiles','meals','meal_items','weights','sessions','login_attempts')"
    ).all<{ name: string }>();
    return tables.results.length === 6;
  } catch {
    return false;
  }
}
