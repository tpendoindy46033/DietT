import { useMemo, useState } from "react";
import type { MealType } from "@shared/types";
import { calculateTotals } from "@shared/nutrition";
import { Icon, mealTypeIcon } from "./Icon";
import { Donut } from "../charts/Donut";
import { CHART_COLORS } from "../charts/chartUtils";
import { ConfirmDialog } from "./Modal";

export interface EditableItem {
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
  preparation: string;
  confidence: number | null;
  assumptions: string;
}

export interface MealDraft {
  mealName: string;
  mealType: MealType;
  mealDate: string;
  mealTime: string;
  notes: string;
  items: EditableItem[];
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" }
];

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
}

export function emptyItem(): EditableItem {
  return {
    id: makeId(),
    foodName: "",
    amount: 1,
    unit: "serving",
    estimatedGrams: 0,
    calories: 0,
    proteinGrams: 0,
    carbohydrateGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
    preparation: "",
    confidence: null,
    assumptions: ""
  };
}

export function MealEditor({
  draft,
  onChange,
  showEstimateBanner,
  warnings,
  onSave,
  onCancel,
  saving,
  saveLabel = "Save meal"
}: {
  draft: MealDraft;
  onChange: (draft: MealDraft) => void;
  showEstimateBanner: boolean;
  warnings?: string[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const totals = useMemo(() => calculateTotals(draft.items), [draft.items]);
  const canSave = draft.mealName.trim().length > 0 && draft.items.length > 0 && draft.items.every((i) => i.foodName.trim().length > 0);

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    const items = draft.items.slice();
    items[index] = { ...items[index], ...patch };
    onChange({ ...draft, items });
  };

  const removeItem = (index: number) => {
    onChange({ ...draft, items: draft.items.filter((_, i) => i !== index) });
  };

  const addItem = () => {
    onChange({ ...draft, items: [...draft.items, emptyItem()] });
  };

  return (
    <div className="stack">
      {showEstimateBanner && (
        <div className="estimate-banner">
          <Icon name="sparkle" />
          <div>
            <strong>Estimated by GPT-5 Nano.</strong> AI-generated nutrition estimates may not be exact. Ingredients, portion sizes,
            oils, sauces, and preparation methods can significantly change the result. Review and edit the values before saving.
          </div>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="card" style={{ background: "var(--color-bg-tint)" }}>
          <div className="row" style={{ marginBottom: "var(--space-2)" }}>
            <Icon name="warning" size={16} />
            <span className="text-sm" style={{ fontWeight: 600 }}>
              Things to double-check
            </span>
          </div>
          <ul className="text-sm text-muted" style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack">
        <div className="field">
          <label htmlFor="meal-name">Meal name</label>
          <input
            id="meal-name"
            className="input"
            value={draft.mealName}
            onChange={(e) => onChange({ ...draft, mealName: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label>Meal type</label>
          <div className="chip-group" role="radiogroup" aria-label="Meal type">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt.value}
                type="button"
                className="chip"
                role="radio"
                aria-pressed={draft.mealType === mt.value}
                aria-checked={draft.mealType === mt.value}
                onClick={() => onChange({ ...draft, mealType: mt.value })}
              >
                <Icon name={mealTypeIcon(mt.value)} size={16} />
                {mt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row form-row-2">
          <div className="field">
            <label htmlFor="meal-date">Date</label>
            <input
              id="meal-date"
              className="input"
              type="date"
              value={draft.mealDate}
              onChange={(e) => onChange({ ...draft, mealDate: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="meal-time">Time</label>
            <input
              id="meal-time"
              className="input"
              type="time"
              value={draft.mealTime}
              onChange={(e) => onChange({ ...draft, mealTime: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="meal-notes">Notes (optional)</label>
          <textarea
            id="meal-notes"
            className="textarea"
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Macro split</span>
        </div>
        <Donut
          centerLabel="total kcal"
          centerValue={String(Math.round(totals.calories))}
          slices={[
            { key: "protein", label: "Protein", value: totals.proteinGrams * 4, color: CHART_COLORS.protein },
            { key: "carb", label: "Carbs", value: totals.carbohydrateGrams * 4, color: CHART_COLORS.carb },
            { key: "fat", label: "Fat", value: totals.fatGrams * 9, color: CHART_COLORS.fat }
          ]}
          emptyMessage="Add items to see the macro split."
        />
      </div>

      <div className="stack">
        <div className="row-between">
          <span className="card-title">Items</span>
          <button type="button" className="btn btn-secondary" onClick={addItem}>
            <Icon name="plus" size={16} /> Add item
          </button>
        </div>

        {draft.items.length === 0 && <p className="text-sm text-faint">No items yet. Add at least one food item.</p>}

        {draft.items.map((item, index) => (
          <div className="item-row" key={item.id}>
            <div className="item-row-head">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={`food-${item.id}`}>Food</label>
                <input
                  id={`food-${item.id}`}
                  className="input"
                  value={item.foodName}
                  onChange={(e) => updateItem(index, { foodName: e.target.value })}
                  required
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Remove item"
                onClick={() => setConfirmDeleteIndex(index)}
                style={{ marginTop: 22 }}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>

            <div className="form-row form-row-3">
              <NumberField label="Amount" value={item.amount} onChange={(v) => updateItem(index, { amount: v })} min={0} step={0.5} />
              <div className="field">
                <label htmlFor={`unit-${item.id}`}>Unit</label>
                <input id={`unit-${item.id}`} className="input" value={item.unit} onChange={(e) => updateItem(index, { unit: e.target.value })} />
              </div>
              <NumberField label="Grams" value={item.estimatedGrams} onChange={(v) => updateItem(index, { estimatedGrams: v })} min={0} />
            </div>

            <div className="form-row form-row-3">
              <NumberField label="Calories" value={item.calories} onChange={(v) => updateItem(index, { calories: v })} min={0} />
              <NumberField label="Protein (g)" value={item.proteinGrams} onChange={(v) => updateItem(index, { proteinGrams: v })} min={0} />
              <NumberField label="Carbs (g)" value={item.carbohydrateGrams} onChange={(v) => updateItem(index, { carbohydrateGrams: v })} min={0} />
            </div>
            <div className="form-row form-row-2">
              <NumberField label="Fat (g)" value={item.fatGrams} onChange={(v) => updateItem(index, { fatGrams: v })} min={0} />
              <NumberField label="Fiber (g)" value={item.fiberGrams} onChange={(v) => updateItem(index, { fiberGrams: v })} min={0} />
            </div>

            <div className="field">
              <label htmlFor={`prep-${item.id}`}>Preparation (optional)</label>
              <input
                id={`prep-${item.id}`}
                className="input"
                value={item.preparation}
                onChange={(e) => updateItem(index, { preparation: e.target.value })}
              />
            </div>

            {item.confidence !== null && (
              <div className="item-row-confidence">Estimate confidence: {Math.round(item.confidence * 100)}%</div>
            )}
            {item.assumptions && <div className="item-assumptions">{item.assumptions}</div>}

            {confirmDeleteIndex === index && (
              <ConfirmDialog
                title="Remove this item?"
                message={`"${item.foodName || "This item"}" will be removed from the meal.`}
                onCancel={() => setConfirmDeleteIndex(null)}
                onConfirm={() => {
                  setConfirmDeleteIndex(null);
                  removeItem(index);
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card row-between">
        <span className="card-title">Total</span>
        <span className="meal-card-calories tabular">{Math.round(totals.calories)} kcal</span>
      </div>

      <div className="row" style={{ position: "sticky", bottom: "calc(var(--nav-height) + var(--space-4))" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={!canSave || saving} onClick={onSave}>
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  const id = `num-${label.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input tabular"
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}
