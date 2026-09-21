import { useCallback, useEffect, useMemo, useState } from "react";
import type { Meal, MealType } from "@shared/types";
import { calculateTotals } from "@shared/nutrition";
import { api, ApiError } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { todayInTimezone, addDaysLocal, formatDateLabel } from "../lib/dates";
import { Icon } from "../components/Icon";
import { MealCard } from "../components/MealCard";
import { SkeletonPage } from "../components/Skeleton";
import { StatePanel } from "../components/StatePanel";
import { StackedBarChart } from "../charts/StackedBarChart";
import { CHART_COLORS } from "../charts/chartUtils";
import { useToast } from "../lib/ToastContext";

const MEAL_TYPE_FILTERS: { value: MealType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" }
];

const SERIES = [
  { key: "breakfast", label: "Breakfast", color: CHART_COLORS.protein },
  { key: "lunch", label: "Lunch", color: CHART_COLORS.accent },
  { key: "dinner", label: "Dinner", color: CHART_COLORS.fat },
  { key: "snack", label: "Snack", color: CHART_COLORS.carb }
];

export function HistoryPage() {
  const { profile } = useProfile();
  const { showToast } = useToast();
  const timezone = profile?.timezone ?? "UTC";

  const [rangeDays, setRangeDays] = useState(14);
  const [search, setSearch] = useState("");
  const [mealTypeFilter, setMealTypeFilter] = useState<MealType | "all">("all");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = todayInTimezone(timezone);
  const fromDate = addDaysLocal(today, -(rangeDays - 1));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: fromDate, to: today });
      if (mealTypeFilter !== "all") params.set("mealType", mealTypeFilter);
      if (search.trim()) params.set("q", search.trim());
      const data = await api.get<{ meals: Meal[] }>(`/api/meals?${params.toString()}`);
      setMeals(data.meals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your history.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, today, mealTypeFilter, search]);

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

  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < rangeDays; i++) list.push(addDaysLocal(today, -i));
    return list;
  }, [today, rangeDays]);

  const mealsByDate = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const meal of meals) {
      const list = map.get(meal.mealDate) ?? [];
      list.push(meal);
      map.set(meal.mealDate, list);
    }
    return map;
  }, [meals]);

  const chartData = useMemo(
    () =>
      [...days].reverse().map((date) => {
        const dayMeals = mealsByDate.get(date) ?? [];
        const values: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
        for (const meal of dayMeals) values[meal.mealType] += meal.totals.calories;
        return { label: formatDateLabel(date), values };
      }),
    [days, mealsByDate]
  );

  const summary = useMemo(() => {
    const totals = calculateTotals(meals.map((m) => m.totals));
    const loggedDays = new Set(meals.map((m) => m.mealDate)).size;
    return { totals, loggedDays };
  }, [meals]);

  return (
    <div className="stack">
      <div className="app-topbar">
        <h1>History</h1>
      </div>

      <div className="filter-bar">
        <div className="row" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={16} className="text-faint" />
          <input
            className="input"
            placeholder="Search meals or foods"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search meals"
          />
        </div>
        <select className="select" style={{ width: "auto" }} value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className="chip-group">
        {MEAL_TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className="chip"
            aria-pressed={mealTypeFilter === f.value}
            onClick={() => setMealTypeFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonPage />
      ) : error ? (
        <StatePanel icon="warning" variant="error" title="Couldn't load history" description={error} />
      ) : (
        <>
          <div className="grid grid-3">
            <div className="stat-tile">
              <span className="stat-tile-value tabular">{Math.round(summary.totals.calories)}</span>
              <span className="stat-tile-label">Total kcal logged</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value tabular">{summary.loggedDays}</span>
              <span className="stat-tile-label">Days with entries</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value tabular">{meals.length}</span>
              <span className="stat-tile-label">Meals found</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title-row">
              <span className="card-title">Calories per day by meal</span>
            </div>
            <StackedBarChart data={chartData} series={SERIES} />
          </div>

          <div className="stack">
            {days.map((date) => {
              const dayMeals = mealsByDate.get(date) ?? [];
              const dayTotals = calculateTotals(dayMeals.map((m) => m.totals));
              return (
                <div key={date} className="stack" style={{ gap: "var(--space-2)" }}>
                  <div className="day-group-header">
                    <h3>{formatDateLabel(date, { weekday: true })}</h3>
                    {dayMeals.length > 0 && <span className="text-sm text-muted tabular">{Math.round(dayTotals.calories)} kcal</span>}
                  </div>
                  {dayMeals.length === 0 ? (
                    <p className="text-sm text-faint">No entries logged.</p>
                  ) : (
                    dayMeals.map((meal) => <MealCard key={meal.id} meal={meal} onDeleted={handleDelete} />)
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
