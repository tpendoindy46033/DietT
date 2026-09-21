import { useState } from "react";
import type { Meal } from "@shared/types";
import { Icon } from "./Icon";
import { MacroStrip } from "../charts/MacroStrip";
import { ConfirmDialog } from "./Modal";
import { formatTimeLabel } from "../lib/dates";
import { useNavigate } from "../lib/router";

export function MealCard({ meal, onDeleted }: { meal: Meal; onDeleted: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="meal-card">
      <div className="meal-card-head">
        <div>
          <div className="meal-card-name">{meal.mealName}</div>
          <div className="meal-card-meta">
            {formatTimeLabel(meal.mealTime)}
            {meal.items.length > 0 && ` · ${meal.items.length} item${meal.items.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="meal-card-actions">
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Edit meal" onClick={() => navigate(`/meals/${meal.id}/edit`)}>
            <Icon name="edit" size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Delete meal" onClick={() => setConfirming(true)}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      <div className="row-between">
        <span className="meal-card-calories tabular">{Math.round(meal.totals.calories)} kcal</span>
      </div>

      <MacroStrip proteinGrams={meal.totals.proteinGrams} carbohydrateGrams={meal.totals.carbohydrateGrams} fatGrams={meal.totals.fatGrams} />

      {confirming && (
        <ConfirmDialog
          title="Delete this meal?"
          message={`This will permanently remove "${meal.mealName}" and its ${meal.items.length} item${meal.items.length === 1 ? "" : "s"}.`}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onDeleted(meal.id);
          }}
        />
      )}
    </div>
  );
}
