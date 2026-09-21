import { describe, expect, test } from "vitest";
import {
  validateAiAnalysis,
  validateMealInput,
  validateWeightInput,
  validateProfileInput,
  validateTextAnalysisInput
} from "@shared/validation";

function validAiItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    foodName: "Cooked white rice",
    amount: 1,
    unit: "cup",
    estimatedGrams: 158,
    calories: 205,
    proteinGrams: 4.3,
    carbohydrateGrams: 44.5,
    fatGrams: 0.4,
    fiberGrams: 0.6,
    preparation: "boiled",
    confidence: 0.85,
    assumptions: "Estimated as one standard cup.",
    ...overrides
  };
}

function validAiResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    mealName: "Vegetable rice bowl",
    mealType: "lunch",
    items: [validAiItem()],
    totals: { calories: 205, proteinGrams: 4.3, carbohydrateGrams: 44.5, fatGrams: 0.4, fiberGrams: 0.6 },
    overallConfidence: 0.85,
    warnings: ["Serving size was estimated."],
    ...overrides
  };
}

describe("validateAiAnalysis", () => {
  test("accepts a well-formed response", () => {
    const result = validateAiAnalysis(validAiResponse());
    expect(result.valid).toBe(true);
    expect(result.value?.items).toHaveLength(1);
  });

  test("rejects a missing mealName", () => {
    const result = validateAiAnalysis(validAiResponse({ mealName: "" }));
    expect(result.valid).toBe(false);
  });

  test("rejects an invalid mealType", () => {
    const result = validateAiAnalysis(validAiResponse({ mealType: "brunch" }));
    expect(result.valid).toBe(false);
  });

  test("rejects negative calories on an item", () => {
    const result = validateAiAnalysis(validAiResponse({ items: [validAiItem({ calories: -10 })] }));
    expect(result.valid).toBe(false);
  });

  test("rejects a confidence outside 0 to 1", () => {
    const result = validateAiAnalysis(validAiResponse({ overallConfidence: 1.5 }));
    expect(result.valid).toBe(false);
  });

  test("rejects calories above the safety ceiling", () => {
    const result = validateAiAnalysis(validAiResponse({ items: [validAiItem({ calories: 999999 })] }));
    expect(result.valid).toBe(false);
  });

  test("rejects a non-numeric amount", () => {
    const result = validateAiAnalysis(validAiResponse({ items: [validAiItem({ amount: "a lot" })] }));
    expect(result.valid).toBe(false);
  });

  test("rejects an empty items array", () => {
    const result = validateAiAnalysis(validAiResponse({ items: [] }));
    expect(result.valid).toBe(false);
  });

  test("rejects a missing food name", () => {
    const result = validateAiAnalysis(validAiResponse({ items: [validAiItem({ foodName: "" })] }));
    expect(result.valid).toBe(false);
  });

  test("rejects a non-object payload", () => {
    expect(validateAiAnalysis(null).valid).toBe(false);
    expect(validateAiAnalysis("string").valid).toBe(false);
    expect(validateAiAnalysis([]).valid).toBe(false);
  });
});

function validMealInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    mealName: "Lunch",
    mealType: "lunch",
    mealDate: "2024-01-01",
    mealTime: "12:30",
    inputMethod: "manual",
    items: [
      {
        foodName: "Rice",
        amount: 1,
        unit: "cup",
        estimatedGrams: 150,
        calories: 200,
        proteinGrams: 4,
        carbohydrateGrams: 40,
        fatGrams: 1,
        fiberGrams: 1
      }
    ],
    ...overrides
  };
}

describe("validateMealInput", () => {
  test("accepts a well-formed meal", () => {
    expect(validateMealInput(validMealInput()).valid).toBe(true);
  });

  test("rejects a bad date format", () => {
    expect(validateMealInput(validMealInput({ mealDate: "01/01/2024" })).valid).toBe(false);
  });

  test("rejects a bad time format", () => {
    expect(validateMealInput(validMealInput({ mealTime: "12pm" })).valid).toBe(false);
  });

  test("rejects an unknown meal type", () => {
    expect(validateMealInput(validMealInput({ mealType: "elevenses" })).valid).toBe(false);
  });

  test("rejects an unknown input method", () => {
    expect(validateMealInput(validMealInput({ inputMethod: "telepathy" })).valid).toBe(false);
  });

  test("rejects zero items", () => {
    expect(validateMealInput(validMealInput({ items: [] })).valid).toBe(false);
  });

  test("rejects a negative item amount", () => {
    const bad = validMealInput();
    (bad.items[0] as Record<string, unknown>).amount = -1;
    expect(validateMealInput(bad).valid).toBe(false);
  });
});

describe("validateWeightInput", () => {
  test("accepts a plausible weight", () => {
    const result = validateWeightInput({ weightValue: 70, weightUnit: "kg", recordedDate: "2024-01-01" });
    expect(result.valid).toBe(true);
  });

  test("rejects a zero or negative weight", () => {
    expect(validateWeightInput({ weightValue: 0, weightUnit: "kg", recordedDate: "2024-01-01" }).valid).toBe(false);
    expect(validateWeightInput({ weightValue: -10, weightUnit: "kg", recordedDate: "2024-01-01" }).valid).toBe(false);
  });

  test("rejects an implausible weight", () => {
    expect(validateWeightInput({ weightValue: 5000, weightUnit: "kg", recordedDate: "2024-01-01" }).valid).toBe(false);
  });

  test("rejects an invalid unit", () => {
    expect(validateWeightInput({ weightValue: 70, weightUnit: "stone", recordedDate: "2024-01-01" }).valid).toBe(false);
  });
});

describe("validateProfileInput", () => {
  test("accepts valid targets", () => {
    const result = validateProfileInput({
      displayName: "Alex",
      timezone: "UTC",
      weightUnit: "kg",
      calorieTarget: 2000,
      proteinTarget: 100,
      carbohydrateTarget: 250,
      fatTarget: 70,
      fiberTarget: 30
    });
    expect(result.valid).toBe(true);
  });

  test("rejects a negative target", () => {
    const result = validateProfileInput({
      displayName: "Alex",
      timezone: "UTC",
      weightUnit: "kg",
      calorieTarget: -100,
      proteinTarget: 100,
      carbohydrateTarget: 250,
      fatTarget: 70,
      fiberTarget: 30
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateTextAnalysisInput", () => {
  test("accepts a non-empty description", () => {
    expect(validateTextAnalysisInput({ description: "Two idlis with sambar" }).valid).toBe(true);
  });

  test("rejects an empty description", () => {
    expect(validateTextAnalysisInput({ description: "" }).valid).toBe(false);
  });

  test("rejects a description over the length limit", () => {
    expect(validateTextAnalysisInput({ description: "a".repeat(5000) }).valid).toBe(false);
  });
});
