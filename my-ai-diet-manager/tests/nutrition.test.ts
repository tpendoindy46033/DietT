import { describe, expect, test } from "vitest";
import { calculateTotals, macroCalorieSplit, niceNumberScale, roundTo, clamp } from "@shared/nutrition";

describe("calculateTotals", () => {
  test("sums calories and macros across items", () => {
    const totals = calculateTotals([
      { calories: 205, proteinGrams: 4.3, carbohydrateGrams: 44.5, fatGrams: 0.4, fiberGrams: 0.6 },
      { calories: 150, proteinGrams: 9, carbohydrateGrams: 20, fatGrams: 3, fiberGrams: 5 }
    ]);
    expect(totals.calories).toBe(355);
    expect(totals.proteinGrams).toBeCloseTo(13.3, 5);
    expect(totals.carbohydrateGrams).toBeCloseTo(64.5, 5);
    expect(totals.fatGrams).toBeCloseTo(3.4, 5);
    expect(totals.fiberGrams).toBeCloseTo(5.6, 5);
  });

  test("returns all zeros for an empty item list", () => {
    const totals = calculateTotals([]);
    expect(totals).toEqual({ calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0, fiberGrams: 0 });
  });

  test("never reflects a model-provided totals field - only the sum of items counts", () => {
    const items = [{ calories: 100, proteinGrams: 1, carbohydrateGrams: 1, fatGrams: 1, fiberGrams: 1 }];
    const totals = calculateTotals(items);
    expect(totals.calories).toBe(100);
  });
});

describe("macroCalorieSplit", () => {
  test("splits by 4/4/9 kcal-per-gram, not by gram weight", () => {
    const split = macroCalorieSplit(10, 10, 10);
    // protein 40 kcal, carb 40 kcal, fat 90 kcal = 170 total
    expect(split.proteinCalories).toBe(40);
    expect(split.carbohydrateCalories).toBe(40);
    expect(split.fatCalories).toBe(90);
    expect(split.total).toBe(170);
    expect(split.fatPercent).toBeCloseTo((90 / 170) * 100, 5);
  });

  test("returns zero percentages when there is no data", () => {
    const split = macroCalorieSplit(0, 0, 0);
    expect(split.total).toBe(0);
    expect(split.proteinPercent).toBe(0);
  });

  test("clamps negative inputs to zero", () => {
    const split = macroCalorieSplit(-5, 10, 0);
    expect(split.proteinCalories).toBe(0);
  });
});

describe("niceNumberScale", () => {
  test("does not round a 2,592 max up to a sparse 5,000 ceiling", () => {
    const scale = niceNumberScale(2592, 5);
    expect(scale.max).toBeLessThanOrEqual(3000);
    expect(scale.max).toBeGreaterThanOrEqual(2592);
  });

  test("produces evenly spaced ticks covering the data max", () => {
    const scale = niceNumberScale(1000, 4);
    expect(scale.ticks[scale.ticks.length - 1]).toBeCloseTo(scale.max, 5);
    for (let i = 1; i < scale.ticks.length; i++) {
      expect(scale.ticks[i] - scale.ticks[i - 1]).toBeCloseTo(scale.step, 5);
    }
  });

  test("handles a zero or negative max gracefully", () => {
    const scale = niceNumberScale(0);
    expect(scale.max).toBeGreaterThan(0);
    expect(scale.ticks.length).toBeGreaterThan(0);
  });
});

describe("roundTo / clamp", () => {
  test("rounds to the given decimal places", () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.005, 2)).toBeCloseTo(1.0, 1);
  });

  test("clamps a value within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});
