import { describe, expect, test } from "vitest";
import { buildYScale, hasNoData, formatCompactNumber } from "@frontend/charts/chartUtils";

describe("hasNoData (drives every chart's empty state)", () => {
  test("is true for an empty array", () => {
    expect(hasNoData([])).toBe(true);
  });

  test("is true when every value is zero", () => {
    expect(hasNoData([0, 0, 0])).toBe(true);
  });

  test("is false when at least one value is non-zero", () => {
    expect(hasNoData([0, 0, 5])).toBe(false);
  });
});

describe("buildYScale", () => {
  test("never produces a scale smaller than the data max", () => {
    const scale = buildYScale(2592);
    expect(scale.max).toBeGreaterThanOrEqual(2592);
  });

  test("toY maps the max value to the top of the plot area", () => {
    const scale = buildYScale(100, 4);
    expect(scale.toY(scale.max, 200)).toBeCloseTo(0, 5);
    expect(scale.toY(0, 200)).toBeCloseTo(200, 5);
  });
});

describe("formatCompactNumber", () => {
  test("keeps small numbers as-is", () => {
    expect(formatCompactNumber(450)).toBe("450");
  });

  test("compacts thousands", () => {
    expect(formatCompactNumber(2000)).toBe("2k");
    expect(formatCompactNumber(2500)).toBe("2.5k");
  });
});
