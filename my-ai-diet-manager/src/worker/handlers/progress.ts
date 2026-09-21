import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import { listMeals, listWeights } from "../db";
import { addDays, dateRangeEndingAt, isValidDateString, todayUtcDateString } from "../dateUtils";
import type { Meal, MealType, WeightUnit } from "@shared/types";
import { roundTo } from "@shared/nutrition";

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const DAYS = 30;

function toKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value * 0.45359237 : value;
}

export async function handleProgress(env: Env, url: URL): Promise<Response> {
  const dateParam = url.searchParams.get("date");
  if (dateParam && !isValidDateString(dateParam)) {
    throw new ApiHttpError("VALIDATION_ERROR", "date must be YYYY-MM-DD.", 422);
  }
  const endDate = dateParam ?? todayUtcDateString();
  const startDate = addDays(endDate, -(DAYS - 1));

  const [meals, weights] = await Promise.all([
    listMeals(env, { from: startDate, to: endDate }),
    listWeights(env, startDate, endDate)
  ]);

  const allDays = dateRangeEndingAt(endDate, DAYS);
  const mealsByDate = new Map<string, Meal[]>();
  for (const day of allDays) mealsByDate.set(day, []);
  for (const meal of meals) {
    const list = mealsByDate.get(meal.mealDate);
    if (list) list.push(meal);
  }

  const thirtyDayCalories = allDays.map((date) => ({
    date,
    calories: (mealsByDate.get(date) ?? []).reduce((sum, m) => sum + m.totals.calories, 0)
  }));
  const sevenDayCalories = thirtyDayCalories.slice(-7);

  const consistency = allDays.map((date) => ({ date, logged: (mealsByDate.get(date) ?? []).length > 0 }));

  const macroTrend = allDays.map((date) => {
    const dayMeals = mealsByDate.get(date) ?? [];
    return {
      date,
      proteinGrams: roundTo(dayMeals.reduce((s, m) => s + m.totals.proteinGrams, 0), 1),
      carbohydrateGrams: roundTo(dayMeals.reduce((s, m) => s + m.totals.carbohydrateGrams, 0), 1),
      fatGrams: roundTo(dayMeals.reduce((s, m) => s + m.totals.fatGrams, 0), 1),
      fiberGrams: roundTo(dayMeals.reduce((s, m) => s + m.totals.fiberGrams, 0), 1)
    };
  });

  const loggedDays = allDays.filter((date) => (mealsByDate.get(date) ?? []).length > 0);
  const daysLogged = loggedDays.length;

  const averageCalories = daysLogged > 0 ? roundTo(thirtyDayCalories.reduce((s, d) => s + d.calories, 0) / daysLogged, 0) : 0;
  const averageProtein = daysLogged > 0 ? roundTo(macroTrend.reduce((s, d) => s + d.proteinGrams, 0) / daysLogged, 1) : 0;
  const averageCarb = daysLogged > 0 ? macroTrend.reduce((s, d) => s + d.carbohydrateGrams, 0) / daysLogged : 0;
  const averageFat = daysLogged > 0 ? macroTrend.reduce((s, d) => s + d.fatGrams, 0) / daysLogged : 0;

  const caloriesByMealType = MEAL_TYPE_ORDER.map((mealType) => ({
    mealType,
    calories: meals.filter((m) => m.mealType === mealType).reduce((sum, m) => sum + m.totals.calories, 0)
  }));

  const weightTrend = [...weights].reverse().map((w) => ({ date: w.recordedDate, weightValue: w.weightValue, weightUnit: w.weightUnit }));

  let weightChange: { value: number; unit: WeightUnit } | null = null;
  if (weightTrend.length >= 2) {
    const first = weightTrend[0];
    const last = weightTrend[weightTrend.length - 1];
    const diffKg = toKg(last.weightValue, last.weightUnit) - toKg(first.weightValue, first.weightUnit);
    const value = last.weightUnit === "lb" ? diffKg / 0.45359237 : diffKg;
    weightChange = { value: roundTo(value, 1), unit: last.weightUnit };
  }

  return jsonOk({
    sevenDayCalories,
    thirtyDayCalories,
    consistency,
    macroTrend,
    weightTrend,
    averageCalories,
    averageProtein,
    daysLogged,
    averageMacroSplit: {
      proteinGrams: averageProtein,
      carbohydrateGrams: roundTo(averageCarb, 1),
      fatGrams: roundTo(averageFat, 1)
    },
    caloriesByMealType,
    weightChange
  });
}
