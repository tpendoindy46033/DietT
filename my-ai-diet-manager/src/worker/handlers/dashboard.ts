import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import { getLatestWeight, getProfile, listMeals } from "../db";
import { calculateTotals } from "@shared/nutrition";
import { addDays, isValidDateString, todayUtcDateString } from "../dateUtils";
import type { DashboardMealGroup, MacroTotals, Meal, MealType } from "@shared/types";

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function sumTotals(meals: Meal[]): MacroTotals {
  return calculateTotals(meals.map((m) => m.totals));
}

export async function handleDashboard(env: Env, url: URL): Promise<Response> {
  const dateParam = url.searchParams.get("date");
  const date = dateParam && isValidDateString(dateParam) ? dateParam : todayUtcDateString();
  if (dateParam && !isValidDateString(dateParam)) {
    throw new ApiHttpError("VALIDATION_ERROR", "date must be YYYY-MM-DD.", 422);
  }

  const [profile, todaysMeals, latestWeight, rangeMeals] = await Promise.all([
    getProfile(env),
    listMeals(env, { date }),
    getLatestWeight(env),
    listMeals(env, { from: addDays(date, -6), to: date })
  ]);

  const consumed = sumTotals(todaysMeals);
  const groups: DashboardMealGroup[] = MEAL_TYPE_ORDER.map((mealType) => {
    const meals = todaysMeals.filter((m) => m.mealType === mealType);
    return { mealType, meals, totals: sumTotals(meals) };
  });

  const sevenDayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) sevenDayMap.set(addDays(date, -i), 0);
  for (const meal of rangeMeals) {
    sevenDayMap.set(meal.mealDate, (sevenDayMap.get(meal.mealDate) ?? 0) + meal.totals.calories);
  }
  const sevenDayCalories = Array.from(sevenDayMap.entries()).map(([d, calories]) => ({ date: d, calories }));

  const caloriesByMealType = MEAL_TYPE_ORDER.map((mealType) => ({
    mealType,
    calories: todaysMeals.filter((m) => m.mealType === mealType).reduce((sum, m) => sum + m.totals.calories, 0)
  }));

  return jsonOk({
    date,
    profile,
    consumed,
    remainingCalories: profile.calorieTarget - consumed.calories,
    groups,
    latestWeight,
    sevenDayCalories,
    caloriesByMealType
  });
}
