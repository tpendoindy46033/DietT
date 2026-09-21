import { useCallback, useEffect, useState } from "react";
import type { ProgressData } from "@shared/types";
import { api, ApiError } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { todayInTimezone, formatDateLabel } from "../lib/dates";
import { SkeletonPage } from "../components/Skeleton";
import { StatePanel } from "../components/StatePanel";
import { BarChart } from "../charts/BarChart";
import { LineAreaChart } from "../charts/LineAreaChart";
import { Donut } from "../charts/Donut";
import { Heatmap } from "../charts/Heatmap";
import { CHART_COLORS } from "../charts/chartUtils";

const MEAL_TYPE_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

export function ProgressPage() {
  const { profile } = useProfile();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const date = todayInTimezone(profile.timezone);
      const result = await api.get<ProgressData>(`/api/progress?date=${date}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your progress.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !profile) return <SkeletonPage />;
  if (error || !data) {
    return <StatePanel icon="warning" variant="error" title="Couldn't load progress" description={error ?? "Please try again."} />;
  }

  const weightUnit = data.weightTrend[data.weightTrend.length - 1]?.weightUnit ?? profile.weightUnit;

  return (
    <div className="stack">
      <div className="app-topbar">
        <h1>Progress</h1>
      </div>

      <div className="grid grid-3">
        <div className="stat-tile">
          <span className="stat-tile-value tabular">{Math.round(data.averageCalories)}</span>
          <span className="stat-tile-label">Avg. daily calories</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value tabular">{Math.round(data.averageProtein)}g</span>
          <span className="stat-tile-label">Avg. daily protein</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value tabular">{data.daysLogged}</span>
          <span className="stat-tile-label">Days logged (30d)</span>
        </div>
      </div>

      <div className="grid grid-dashboard">
        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Last 7 days</span>
          </div>
          <BarChart data={data.sevenDayCalories.map((d) => ({ label: formatDateLabel(d.date), value: d.calories }))} target={profile.calorieTarget} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Last 30 days</span>
          </div>
          <BarChart data={data.thirtyDayCalories.map((d) => ({ label: "", value: d.calories }))} target={profile.calorieTarget} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Consistency</span>
            <span className="card-subtitle">Last 30 days</span>
          </div>
          <Heatmap days={data.consistency} />
        </div>

        <div className="card span-2">
          <div className="card-title-row">
            <span className="card-title">Macro trend</span>
            <span className="card-subtitle">Last 30 days</span>
          </div>
          <LineAreaChart
            labels={data.macroTrend.map((d) => formatDateLabel(d.date))}
            series={[
              { key: "protein", label: "Protein", color: CHART_COLORS.protein, values: data.macroTrend.map((d) => d.proteinGrams) },
              { key: "carb", label: "Carbs", color: CHART_COLORS.carb, values: data.macroTrend.map((d) => d.carbohydrateGrams) },
              { key: "fat", label: "Fat", color: CHART_COLORS.fat, values: data.macroTrend.map((d) => d.fatGrams) },
              { key: "fiber", label: "Fiber", color: CHART_COLORS.fiber, values: data.macroTrend.map((d) => d.fiberGrams) }
            ]}
          />
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Average macro split</span>
          </div>
          <Donut
            centerLabel="avg / day"
            centerValue={`${Math.round(data.averageCalories)}`}
            slices={[
              { key: "protein", label: "Protein", value: data.averageMacroSplit.proteinGrams * 4, color: CHART_COLORS.protein },
              { key: "carb", label: "Carbs", value: data.averageMacroSplit.carbohydrateGrams * 4, color: CHART_COLORS.carb },
              { key: "fat", label: "Fat", value: data.averageMacroSplit.fatGrams * 9, color: CHART_COLORS.fat }
            ]}
          />
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Calories by meal</span>
            <span className="card-subtitle">Last 30 days</span>
          </div>
          <Donut
            centerLabel="kcal total"
            centerValue={formatKcalTotal(data.caloriesByMealType.reduce((s, m) => s + m.calories, 0))}
            slices={data.caloriesByMealType.map((m) => ({
              key: m.mealType,
              label: MEAL_TYPE_LABEL[m.mealType],
              value: m.calories,
              color: mealTypeColor(m.mealType)
            }))}
          />
        </div>

        <div className="card span-2">
          <div className="card-title-row">
            <span className="card-title">Weight trend</span>
            {data.weightChange && (
              <span className="card-subtitle tabular">
                {data.weightChange.value > 0 ? "+" : ""}
                {data.weightChange.value} {data.weightChange.unit} over this period
              </span>
            )}
          </div>
          <LineAreaChart
            labels={data.weightTrend.map((w) => formatDateLabel(w.date))}
            series={[
              {
                key: "weight",
                label: `Weight (${weightUnit})`,
                color: CHART_COLORS.accent,
                values: data.weightTrend.map((w) => w.weightValue),
                areaFill: true
              }
            ]}
            emptyMessage="Log your weight a few times to see a trend."
          />
        </div>
      </div>
    </div>
  );
}

function formatKcalTotal(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

function mealTypeColor(mealType: string): string {
  if (mealType === "breakfast") return CHART_COLORS.protein;
  if (mealType === "lunch") return CHART_COLORS.accent;
  if (mealType === "dinner") return CHART_COLORS.fat;
  return CHART_COLORS.carb;
}
