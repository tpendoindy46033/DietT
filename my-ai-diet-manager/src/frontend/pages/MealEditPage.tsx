import { useEffect, useState } from "react";
import type { Meal } from "@shared/types";
import { MealEditor, type MealDraft } from "../components/MealEditor";
import { SkeletonPage } from "../components/Skeleton";
import { StatePanel } from "../components/StatePanel";
import { api, ApiError } from "../lib/api";
import { useNavigate } from "../lib/router";
import { useToast } from "../lib/ToastContext";

function mealToDraft(meal: Meal): MealDraft {
  return {
    mealName: meal.mealName,
    mealType: meal.mealType,
    mealDate: meal.mealDate,
    mealTime: meal.mealTime.slice(0, 5),
    notes: meal.notes ?? "",
    items: meal.items.map((item) => ({
      id: item.id,
      foodName: item.foodName,
      amount: item.amount,
      unit: item.unit,
      estimatedGrams: item.estimatedGrams,
      calories: item.calories,
      proteinGrams: item.proteinGrams,
      carbohydrateGrams: item.carbohydrateGrams,
      fatGrams: item.fatGrams,
      fiberGrams: item.fiberGrams,
      preparation: item.preparation ?? "",
      confidence: item.confidence,
      assumptions: item.assumptions ?? ""
    }))
  };
}

export function MealEditPage({ mealId }: { mealId: string }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Meal>(`/api/meals/${mealId}`);
        if (!cancelled) {
          setMeal(data);
          setDraft(mealToDraft(data));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load that meal.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mealId]);

  const handleSave = async () => {
    if (!draft || !meal) return;
    setSaving(true);
    try {
      await api.put(`/api/meals/${mealId}`, {
        mealName: draft.mealName,
        mealType: draft.mealType,
        mealDate: draft.mealDate,
        mealTime: draft.mealTime,
        inputMethod: meal.inputMethod,
        originalText: meal.originalText,
        notes: draft.notes || null,
        aiModel: meal.aiModel,
        overallConfidence: meal.overallConfidence,
        items: draft.items.map((item) => ({
          foodName: item.foodName,
          amount: item.amount,
          unit: item.unit,
          estimatedGrams: item.estimatedGrams,
          calories: item.calories,
          proteinGrams: item.proteinGrams,
          carbohydrateGrams: item.carbohydrateGrams,
          fatGrams: item.fatGrams,
          fiberGrams: item.fiberGrams,
          preparation: item.preparation || null,
          confidence: item.confidence,
          assumptions: item.assumptions || null
        }))
      });
      showToast("Meal updated.");
      navigate("/today");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not save your changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonPage />;
  if (error || !draft) {
    return <StatePanel icon="warning" variant="error" title="Couldn't load this meal" description={error ?? "Please go back and try again."} />;
  }

  return (
    <div className="stack">
      <div className="app-topbar">
        <h1>Edit meal</h1>
      </div>
      <MealEditor
        draft={draft}
        onChange={setDraft}
        showEstimateBanner={!!meal?.aiModel}
        onSave={handleSave}
        onCancel={() => navigate("/today")}
        saving={saving}
        saveLabel="Save changes"
      />
    </div>
  );
}
