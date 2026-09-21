import { SAFETY_LIMITS } from "./nutrition";
import type { AiAnalysisResult, AiAnalyzedItem, MealType, WeightUnit } from "./types";

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  value?: T;
}

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
export const WEIGHT_UNITS: WeightUnit[] = ["kg", "lb"];

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates one raw food item as returned by the model, before it's trusted. */
export function validateAiItem(raw: unknown, index: number): ValidationResult<AiAnalyzedItem> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { valid: false, errors: [`item[${index}] is not an object`] };
  }

  const foodName = raw.foodName;
  const amount = raw.amount;
  const unit = raw.unit;
  const estimatedGrams = raw.estimatedGrams;
  const calories = raw.calories;
  const proteinGrams = raw.proteinGrams;
  const carbohydrateGrams = raw.carbohydrateGrams;
  const fatGrams = raw.fatGrams;
  const fiberGrams = raw.fiberGrams;
  const preparation = raw.preparation;
  const confidence = raw.confidence;
  const assumptions = raw.assumptions;

  if (!isNonEmptyString(foodName)) errors.push(`item[${index}].foodName is missing`);
  if (!isFiniteNumber(amount) || amount <= 0 || amount > SAFETY_LIMITS.MAX_AMOUNT) {
    errors.push(`item[${index}].amount is invalid`);
  }
  if (!isNonEmptyString(unit)) errors.push(`item[${index}].unit is missing`);
  if (!isFiniteNumber(estimatedGrams) || estimatedGrams < 0 || estimatedGrams > SAFETY_LIMITS.MAX_GRAMS_PER_ITEM) {
    errors.push(`item[${index}].estimatedGrams is invalid`);
  }
  if (!isFiniteNumber(calories) || calories < 0 || calories > SAFETY_LIMITS.MAX_CALORIES_PER_ITEM) {
    errors.push(`item[${index}].calories is invalid`);
  }
  if (!isFiniteNumber(proteinGrams) || proteinGrams < 0 || proteinGrams > SAFETY_LIMITS.MAX_PROTEIN_PER_ITEM) {
    errors.push(`item[${index}].proteinGrams is invalid`);
  }
  if (!isFiniteNumber(carbohydrateGrams) || carbohydrateGrams < 0 || carbohydrateGrams > SAFETY_LIMITS.MAX_CARB_PER_ITEM) {
    errors.push(`item[${index}].carbohydrateGrams is invalid`);
  }
  if (!isFiniteNumber(fatGrams) || fatGrams < 0 || fatGrams > SAFETY_LIMITS.MAX_FAT_PER_ITEM) {
    errors.push(`item[${index}].fatGrams is invalid`);
  }
  if (!isFiniteNumber(fiberGrams) || fiberGrams < 0 || fiberGrams > SAFETY_LIMITS.MAX_FIBER_PER_ITEM) {
    errors.push(`item[${index}].fiberGrams is invalid`);
  }
  if (typeof preparation !== "string") errors.push(`item[${index}].preparation is missing`);
  if (!isFiniteNumber(confidence) || !inRange(confidence, 0, 1)) {
    errors.push(`item[${index}].confidence is invalid`);
  }
  if (typeof assumptions !== "string") errors.push(`item[${index}].assumptions is missing`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      foodName: (foodName as string).trim(),
      amount: amount as number,
      unit: (unit as string).trim(),
      estimatedGrams: estimatedGrams as number,
      calories: calories as number,
      proteinGrams: proteinGrams as number,
      carbohydrateGrams: carbohydrateGrams as number,
      fatGrams: fatGrams as number,
      fiberGrams: fiberGrams as number,
      preparation: (preparation as string).trim(),
      confidence: confidence as number,
      assumptions: (assumptions as string).trim()
    }
  };
}

/** Validates the full raw structured-output payload from gpt-5-nano before it is used. */
export function validateAiAnalysis(raw: unknown): ValidationResult<AiAnalysisResult> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { valid: false, errors: ["response is not an object"] };
  }

  const mealName = raw.mealName;
  const mealType = raw.mealType;
  const items = raw.items;
  const overallConfidence = raw.overallConfidence;
  const warnings = raw.warnings;

  if (!isNonEmptyString(mealName)) errors.push("mealName is missing");
  if (typeof mealType !== "string" || !MEAL_TYPES.includes(mealType as MealType)) {
    errors.push("mealType is invalid");
  }
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("items must be a non-empty array");
  } else if (items.length > SAFETY_LIMITS.MAX_ITEMS_PER_MEAL) {
    errors.push("items exceeds the maximum allowed per meal");
  }
  if (!isFiniteNumber(overallConfidence) || !inRange(overallConfidence, 0, 1)) {
    errors.push("overallConfidence is invalid");
  }
  if (!Array.isArray(warnings) || warnings.some((w) => typeof w !== "string")) {
    errors.push("warnings must be an array of strings");
  }

  if (errors.length > 0) return { valid: false, errors };

  const validatedItems: AiAnalyzedItem[] = [];
  for (const [index, item] of (items as unknown[]).entries()) {
    const result = validateAiItem(item, index);
    if (!result.valid) {
      errors.push(...result.errors);
    } else if (result.value) {
      validatedItems.push(result.value);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      mealName: (mealName as string).trim(),
      mealType: mealType as MealType,
      items: validatedItems,
      totals: { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0, fiberGrams: 0 },
      overallConfidence: overallConfidence as number,
      warnings: warnings as string[]
    }
  };
}

export interface MealItemInput {
  foodName: string;
  amount: number;
  unit: string;
  estimatedGrams: number;
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  preparation?: string | null;
  confidence?: number | null;
  assumptions?: string | null;
}

export function validateMealItemInput(raw: unknown, index: number): ValidationResult<MealItemInput> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { valid: false, errors: [`items[${index}] is not an object`] };

  if (!isNonEmptyString(raw.foodName)) errors.push(`items[${index}].foodName is required`);
  if (!isFiniteNumber(raw.amount) || (raw.amount as number) <= 0) errors.push(`items[${index}].amount must be a positive number`);
  if (!isNonEmptyString(raw.unit)) errors.push(`items[${index}].unit is required`);
  if (!isFiniteNumber(raw.estimatedGrams) || (raw.estimatedGrams as number) < 0) errors.push(`items[${index}].estimatedGrams must be zero or more`);
  if (!isFiniteNumber(raw.calories) || (raw.calories as number) < 0) errors.push(`items[${index}].calories must be zero or more`);
  if (!isFiniteNumber(raw.proteinGrams) || (raw.proteinGrams as number) < 0) errors.push(`items[${index}].proteinGrams must be zero or more`);
  if (!isFiniteNumber(raw.carbohydrateGrams) || (raw.carbohydrateGrams as number) < 0) errors.push(`items[${index}].carbohydrateGrams must be zero or more`);
  if (!isFiniteNumber(raw.fatGrams) || (raw.fatGrams as number) < 0) errors.push(`items[${index}].fatGrams must be zero or more`);
  if (!isFiniteNumber(raw.fiberGrams) || (raw.fiberGrams as number) < 0) errors.push(`items[${index}].fiberGrams must be zero or more`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      foodName: (raw.foodName as string).trim(),
      amount: raw.amount as number,
      unit: (raw.unit as string).trim(),
      estimatedGrams: raw.estimatedGrams as number,
      calories: raw.calories as number,
      proteinGrams: raw.proteinGrams as number,
      carbohydrateGrams: raw.carbohydrateGrams as number,
      fatGrams: raw.fatGrams as number,
      fiberGrams: raw.fiberGrams as number,
      preparation: typeof raw.preparation === "string" ? raw.preparation : null,
      confidence: isFiniteNumber(raw.confidence) ? (raw.confidence as number) : null,
      assumptions: typeof raw.assumptions === "string" ? raw.assumptions : null
    }
  };
}

export interface MealInput {
  mealName: string;
  mealType: MealType;
  mealDate: string;
  mealTime: string;
  inputMethod: "text" | "photo" | "manual";
  originalText?: string | null;
  notes?: string | null;
  aiModel?: string | null;
  overallConfidence?: number | null;
  items: MealItemInput[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export function validateMealInput(raw: unknown): ValidationResult<MealInput> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { valid: false, errors: ["body is not an object"] };

  if (!isNonEmptyString(raw.mealName)) errors.push("mealName is required");
  if (typeof raw.mealType !== "string" || !MEAL_TYPES.includes(raw.mealType as MealType)) errors.push("mealType is invalid");
  if (typeof raw.mealDate !== "string" || !DATE_RE.test(raw.mealDate)) errors.push("mealDate must be YYYY-MM-DD");
  if (typeof raw.mealTime !== "string" || !TIME_RE.test(raw.mealTime)) errors.push("mealTime must be HH:MM");
  if (typeof raw.inputMethod !== "string" || !["text", "photo", "manual"].includes(raw.inputMethod)) {
    errors.push("inputMethod is invalid");
  }
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    errors.push("items must be a non-empty array");
  } else if (raw.items.length > SAFETY_LIMITS.MAX_ITEMS_PER_MEAL) {
    errors.push("items exceeds the maximum allowed per meal");
  }

  if (errors.length > 0) return { valid: false, errors };

  const items: MealItemInput[] = [];
  for (const [index, item] of (raw.items as unknown[]).entries()) {
    const result = validateMealItemInput(item, index);
    if (!result.valid) errors.push(...result.errors);
    else if (result.value) items.push(result.value);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      mealName: (raw.mealName as string).trim().slice(0, 200),
      mealType: raw.mealType as MealType,
      mealDate: raw.mealDate as string,
      mealTime: raw.mealTime as string,
      inputMethod: raw.inputMethod as "text" | "photo" | "manual",
      originalText: typeof raw.originalText === "string" ? raw.originalText.slice(0, SAFETY_LIMITS.MAX_TEXT_LENGTH) : null,
      notes: typeof raw.notes === "string" ? raw.notes.slice(0, 2000) : null,
      aiModel: typeof raw.aiModel === "string" ? raw.aiModel : null,
      overallConfidence: isFiniteNumber(raw.overallConfidence) ? (raw.overallConfidence as number) : null,
      items
    }
  };
}

export interface WeightInput {
  weightValue: number;
  weightUnit: WeightUnit;
  recordedDate: string;
  notes?: string | null;
}

export function validateWeightInput(raw: unknown): ValidationResult<WeightInput> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { valid: false, errors: ["body is not an object"] };

  if (!isFiniteNumber(raw.weightValue) || (raw.weightValue as number) <= 0 || (raw.weightValue as number) > 1000) {
    errors.push("weightValue must be a positive, plausible number");
  }
  if (typeof raw.weightUnit !== "string" || !WEIGHT_UNITS.includes(raw.weightUnit as WeightUnit)) {
    errors.push("weightUnit must be kg or lb");
  }
  if (typeof raw.recordedDate !== "string" || !DATE_RE.test(raw.recordedDate)) {
    errors.push("recordedDate must be YYYY-MM-DD");
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      weightValue: raw.weightValue as number,
      weightUnit: raw.weightUnit as WeightUnit,
      recordedDate: raw.recordedDate as string,
      notes: typeof raw.notes === "string" ? raw.notes.slice(0, 2000) : null
    }
  };
}

export interface ProfileInput {
  displayName: string;
  timezone: string;
  weightUnit: WeightUnit;
  calorieTarget: number;
  proteinTarget: number;
  carbohydrateTarget: number;
  fatTarget: number;
  fiberTarget: number;
}

export function validateProfileInput(raw: unknown): ValidationResult<ProfileInput> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { valid: false, errors: ["body is not an object"] };

  if (!isNonEmptyString(raw.displayName)) errors.push("displayName is required");
  if (!isNonEmptyString(raw.timezone)) errors.push("timezone is required");
  if (typeof raw.weightUnit !== "string" || !WEIGHT_UNITS.includes(raw.weightUnit as WeightUnit)) {
    errors.push("weightUnit must be kg or lb");
  }
  for (const key of ["calorieTarget", "proteinTarget", "carbohydrateTarget", "fatTarget", "fiberTarget"] as const) {
    if (!isFiniteNumber(raw[key]) || (raw[key] as number) < 0 || (raw[key] as number) > 20000) {
      errors.push(`${key} must be a non-negative, plausible number`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      displayName: (raw.displayName as string).trim().slice(0, 100),
      timezone: (raw.timezone as string).trim().slice(0, 100),
      weightUnit: raw.weightUnit as WeightUnit,
      calorieTarget: raw.calorieTarget as number,
      proteinTarget: raw.proteinTarget as number,
      carbohydrateTarget: raw.carbohydrateTarget as number,
      fatTarget: raw.fatTarget as number,
      fiberTarget: raw.fiberTarget as number
    }
  };
}

export function validateTextAnalysisInput(raw: unknown): ValidationResult<{ description: string; mealType?: MealType }> {
  if (!isPlainObject(raw)) return { valid: false, errors: ["body is not an object"] };
  const errors: string[] = [];
  if (!isNonEmptyString(raw.description)) errors.push("description is required");
  else if ((raw.description as string).length > SAFETY_LIMITS.MAX_TEXT_LENGTH) errors.push("description is too long");
  if (raw.mealType !== undefined && (typeof raw.mealType !== "string" || !MEAL_TYPES.includes(raw.mealType as MealType))) {
    errors.push("mealType is invalid");
  }
  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    value: {
      description: (raw.description as string).trim(),
      mealType: raw.mealType as MealType | undefined
    }
  };
}
