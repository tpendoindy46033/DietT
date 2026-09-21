import type { MacroTotals } from "./types";

/** Safety limits used to reject implausible AI output or manual entry. */
export const SAFETY_LIMITS = {
  MAX_CALORIES_PER_ITEM: 4000,
  MAX_GRAMS_PER_ITEM: 3000,
  MAX_AMOUNT: 100,
  MAX_ITEMS_PER_MEAL: 30,
  MAX_PROTEIN_PER_ITEM: 500,
  MAX_CARB_PER_ITEM: 500,
  MAX_FAT_PER_ITEM: 500,
  MAX_FIBER_PER_ITEM: 200,
  MAX_TEXT_LENGTH: 4000,
  MAX_IMAGE_BYTES: 5 * 1024 * 1024
} as const;

export interface CalculableItem {
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

/** Recalculates meal totals from individual items. Never trust a model-provided total. */
export function calculateTotals(items: CalculableItem[]): MacroTotals {
  const totals = items.reduce(
    (acc, item) => {
      acc.calories += item.calories;
      acc.proteinGrams += item.proteinGrams;
      acc.carbohydrateGrams += item.carbohydrateGrams;
      acc.fatGrams += item.fatGrams;
      acc.fiberGrams += item.fiberGrams;
      return acc;
    },
    { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0, fiberGrams: 0 }
  );

  return {
    calories: roundTo(totals.calories, 0),
    proteinGrams: roundTo(totals.proteinGrams, 1),
    carbohydrateGrams: roundTo(totals.carbohydrateGrams, 1),
    fatGrams: roundTo(totals.fatGrams, 1),
    fiberGrams: roundTo(totals.fiberGrams, 1)
  };
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Splits calories by macronutrient using 4/4/9 kcal-per-gram, not by gram weight. */
export function macroCalorieSplit(protein: number, carbohydrate: number, fat: number) {
  const proteinCalories = Math.max(0, protein) * 4;
  const carbohydrateCalories = Math.max(0, carbohydrate) * 4;
  const fatCalories = Math.max(0, fat) * 9;
  const total = proteinCalories + carbohydrateCalories + fatCalories;
  return {
    proteinCalories,
    carbohydrateCalories,
    fatCalories,
    total,
    proteinPercent: total > 0 ? (proteinCalories / total) * 100 : 0,
    carbohydratePercent: total > 0 ? (carbohydrateCalories / total) * 100 : 0,
    fatPercent: total > 0 ? (fatCalories / total) * 100 : 0
  };
}

/**
 * Picks a "nice" axis maximum and tick step for a chart given a data maximum,
 * so e.g. a 2,592 max yields steps like 500/1000 rather than rounding to 5,000.
 */
export function niceNumberScale(dataMax: number, targetTicks = 5): { max: number; step: number; ticks: number[] } {
  if (!Number.isFinite(dataMax) || dataMax <= 0) {
    return { max: targetTicks, step: 1, ticks: Array.from({ length: targetTicks + 1 }, (_, i) => i) };
  }

  const roughStep = dataMax / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  const step = niceNormalized * magnitude;
  const max = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) {
    ticks.push(roundTo(v, 2));
  }
  return { max: roundTo(max, 2), step: roundTo(step, 2), ticks };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
