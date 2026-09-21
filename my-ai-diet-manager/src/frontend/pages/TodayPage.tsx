import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "@shared/types";
import { useProfile } from "../lib/ProfileContext";
import { api, ApiError } from "../lib/api";
import { todayInTimezone, formatDateLabel } from "../lib/dates";
import { SkeletonPage } from "../components/Skeleton";
import { StatePanel } from "../components/StatePanel";
import { Icon, mealTypeIcon } from "../components/Icon";
import { MealCard } from "../components/MealCard";
import { WeightModal } from "../components/WeightModal";
import { ProgressRing } from "../charts/ProgressRing";
import { BarChart } from "../charts/BarChart";
import { Donut } from "../charts/Donut";
import { CHART_COLORS } from "../charts/chartUtils";
import { useNavigate } from "../lib/router";
import { useToast } from "../lib/ToastContext";

const MEAL_TYPE_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

export function TodayPage() {
  const { profile } = useProfile();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const date = todayInTimezone(profile.timezone);
      const result = await api.get<DashboardData>(`/api/dashboard?date=${date}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load today's data.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/meals/${id}`);
      showToast("Meal deleted.");
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not delete that meal.", "error");
    }
  };

  if (loading || !profile) return <SkeletonPage />;
  if (error || !data) {
    return <StatePanel icon="warning" variant="error" title="Couldn't load today" description={error ?? "Please try again."} />;
  }

  const totalMealsToday = data.groups.reduce((sum, g) => sum + g.meals.length, 0);

  return (
    <div className="stack">
      <div className="app-topbar">
        <div>
          <h1>Today</h1>
          <p className="text-sm text-muted">{formatDateLabel(data.date, { weekday: true })}</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={() => setShowWeightModal(true)}>
            <Icon name="scale" size={16} /> Weight
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/add-meal")}>
            <Icon name="plus" size={16} /> Add Meal
          </button>
        </div>
      </div>

      <div className="grid grid-dashboard">
        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Calories</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ProgressRing value={data.consumed.calories} target={profile.calorieTarget} label="kcal" />
          </div>
          <p className="text-sm text-muted" style={{ textAlign: "center" }}>
            {data.remainingCalories >= 0
              ? `${Math.round(data.remainingCalories)} kcal remaining`
              : `${Math.round(Math.abs(data.remainingCalories))} kcal over target`}
          </p>
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Macros</span>
          </div>
          <div className="ring-summary-meters">
            <MacroMeter label="Protein" value={data.consumed.proteinGrams} target={profile.proteinTarget} color={CHART_COLORS.protein} />
            <MacroMeter label="Carbs" value={data.consumed.carbohydrateGrams} target={profile.carbohydrateTarget} color={CHART_COLORS.carb} />
            <MacroMeter label="Fat" value={data.consumed.fatGrams} target={profile.fatTarget} color={CHART_COLORS.fat} />
            <MacroMeter label="Fiber" value={data.consumed.fiberGrams} target={profile.fiberTarget} color={CHART_COLORS.fiber} />
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Latest weight</span>
          </div>
          {data.latestWeight ? (
            <>
              <p className="text-xl tabular" style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>
                {data.latestWeight.weightValue} {data.latestWeight.weightUnit}
              </p>
              <p className="text-xs text-faint">{formatDateLabel(data.latestWeight.recordedDate)}</p>
            </>
          ) : (
            <StatePanel icon="scale" title="No weight logged" description="Log your weight to start tracking trends." />
          )}
        </div>

        <div className="card span-2">
          <div className="card-title-row">
            <span className="card-title">Last 7 days</span>
            <span className="card-subtitle">Calories vs target</span>
          </div>
          <BarChart
            data={data.sevenDayCalories.map((d) => ({ label: formatDateLabel(d.date), value: d.calories }))}
            target={profile.calorieTarget}
          />
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Today's calories by macro</span>
          </div>
          <Donut
            centerLabel="kcal today"
            centerValue={String(Math.round(data.consumed.calories))}
            slices={[
              { key: "protein", label: "Protein", value: data.consumed.proteinGrams * 4, color: CHART_COLORS.protein },
              { key: "carb", label: "Carbs", value: data.consumed.carbohydrateGrams * 4, color: CHART_COLORS.carb },
              { key: "fat", label: "Fat", value: data.consumed.fatGrams * 9, color: CHART_COLORS.fat }
            ]}
          />
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">Calories by meal</span>
          </div>
          <Donut
            centerLabel="meals today"
            centerValue={String(totalMealsToday)}
            slices={data.caloriesByMealType.map((m) => ({
              key: m.mealType,
              label: MEAL_TYPE_LABEL[m.mealType],
              value: m.calories,
              color: mealTypeColor(m.mealType)
            }))}
          />
        </div>
      </div>

      <div className="stack">
        {data.groups.map((group) => (
          <div key={group.mealType} className="stack" style={{ gap: "var(--space-2)" }}>
            <div className="meal-group-title">
              <Icon name={mealTypeIcon(group.mealType)} />
              {MEAL_TYPE_LABEL[group.mealType]}
              {group.meals.length > 0 && <span className="tabular">· {Math.round(group.totals.calories)} kcal</span>}
            </div>
            {group.meals.length === 0 ? (
              <p className="text-sm text-faint">No {MEAL_TYPE_LABEL[group.mealType].toLowerCase()} logged yet.</p>
            ) : (
              group.meals.map((meal) => <MealCard key={meal.id} meal={meal} onDeleted={handleDelete} />)
            )}
          </div>
        ))}
      </div>

      {showWeightModal && <WeightModal onClose={() => setShowWeightModal(false)} onSaved={load} />}
    </div>
  );
}

function mealTypeColor(mealType: string): string {
  if (mealType === "breakfast") return CHART_COLORS.protein;
  if (mealType === "lunch") return CHART_COLORS.accent;
  if (mealType === "dinner") return CHART_COLORS.fat;
  return CHART_COLORS.carb;
}

function MacroMeter({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="meter">
      <div className="row-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular">
          {Math.round(value)}g / {Math.round(target)}g
        </span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
