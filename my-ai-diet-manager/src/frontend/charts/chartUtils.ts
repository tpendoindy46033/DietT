import { niceNumberScale } from "@shared/nutrition";

export interface YScale {
  max: number;
  ticks: number[];
  toY: (value: number, plotHeight: number) => number;
}

export function buildYScale(dataMax: number, targetTicks = 4): YScale {
  const { max, ticks } = niceNumberScale(Math.max(dataMax, 1), targetTicks);
  return {
    max,
    ticks,
    toY: (value: number, plotHeight: number) => plotHeight - (value / max) * plotHeight
  };
}

/** True when a chart has nothing meaningful to draw: no points, or every value is zero. */
export function hasNoData(values: number[]): boolean {
  return values.length === 0 || values.every((v) => v === 0);
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(value)}`;
}

export const CHART_COLORS = {
  accent: "var(--color-accent)",
  protein: "var(--color-protein)",
  carb: "var(--color-carb)",
  fat: "var(--color-fat)",
  fiber: "var(--color-fiber)",
  border: "var(--color-border)",
  text: "var(--color-text-muted)",
  textFaint: "var(--color-text-faint)"
};
