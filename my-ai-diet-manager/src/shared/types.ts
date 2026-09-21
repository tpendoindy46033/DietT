export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type InputMethod = "text" | "photo" | "manual";
export type WeightUnit = "kg" | "lb";

export interface MealItem {
  id: string;
  foodName: string;
  amount: number;
  unit: string;
  estimatedGrams: number;
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  preparation: string | null;
  confidence: number | null;
  assumptions: string | null;
  nutritionSource: string;
}

export interface MacroTotals {
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface Meal {
  id: string;
  mealName: string;
  mealType: MealType;
  mealDate: string;
  mealTime: string;
  inputMethod: InputMethod;
  originalText: string | null;
  notes: string | null;
  aiModel: string | null;
  overallConfidence: number | null;
  items: MealItem[];
  totals: MacroTotals;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  displayName: string;
  timezone: string;
  weightUnit: WeightUnit;
  calorieTarget: number;
  proteinTarget: number;
  carbohydrateTarget: number;
  fatTarget: number;
  fiberTarget: number;
}

export interface WeightEntry {
  id: string;
  weightValue: number;
  weightUnit: WeightUnit;
  recordedDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw shape requested from gpt-5-nano via the Responses API structured output. */
export interface AiAnalyzedItem {
  foodName: string;
  amount: number;
  unit: string;
  estimatedGrams: number;
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  preparation: string;
  confidence: number;
  assumptions: string;
}

export interface AiAnalysisResult {
  mealName: string;
  mealType: MealType;
  items: AiAnalyzedItem[];
  totals: MacroTotals;
  overallConfidence: number;
  warnings: string[];
}

export interface DashboardMealGroup {
  mealType: MealType;
  meals: Meal[];
  totals: MacroTotals;
}

export interface DashboardData {
  date: string;
  profile: Profile;
  consumed: MacroTotals;
  remainingCalories: number;
  groups: DashboardMealGroup[];
  latestWeight: WeightEntry | null;
  sevenDayCalories: { date: string; calories: number }[];
  caloriesByMealType: { mealType: MealType; calories: number }[];
}

export interface ProgressData {
  sevenDayCalories: { date: string; calories: number }[];
  thirtyDayCalories: { date: string; calories: number }[];
  consistency: { date: string; logged: boolean }[];
  macroTrend: { date: string; proteinGrams: number; carbohydrateGrams: number; fatGrams: number; fiberGrams: number }[];
  weightTrend: { date: string; weightValue: number; weightUnit: WeightUnit }[];
  averageCalories: number;
  averageProtein: number;
  daysLogged: number;
  averageMacroSplit: { proteinGrams: number; carbohydrateGrams: number; fatGrams: number };
  caloriesByMealType: { mealType: MealType; calories: number }[];
  weightChange: { value: number; unit: WeightUnit } | null;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;
