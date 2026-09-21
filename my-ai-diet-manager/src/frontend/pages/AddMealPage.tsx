import { useRef, useState } from "react";
import type { AiAnalysisResult } from "@shared/types";
import { Icon } from "../components/Icon";
import { MealEditor, emptyItem, type MealDraft } from "../components/MealEditor";
import { api, ApiError } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { todayInTimezone, nowTimeInTimezone } from "../lib/dates";
import { isSupportedImageType, resizeAndCompressImage } from "../lib/imageResize";
import { useNavigate } from "../lib/router";
import { useToast } from "../lib/ToastContext";

type Tab = "text" | "photo";
type Step = "input" | "analyzing" | "review";

function aiResultToDraft(result: AiAnalysisResult, mealDate: string, mealTime: string): MealDraft {
  return {
    mealName: result.mealName,
    mealType: result.mealType,
    mealDate,
    mealTime,
    notes: "",
    items: result.items.map((item) => ({
      ...emptyItem(),
      foodName: item.foodName,
      amount: item.amount,
      unit: item.unit,
      estimatedGrams: item.estimatedGrams,
      calories: item.calories,
      proteinGrams: item.proteinGrams,
      carbohydrateGrams: item.carbohydrateGrams,
      fatGrams: item.fatGrams,
      fiberGrams: item.fiberGrams,
      preparation: item.preparation,
      confidence: item.confidence,
      assumptions: item.assumptions
    }))
  };
}

export function AddMealPage() {
  const { profile } = useProfile();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("input");
  const [tab, setTab] = useState<Tab>("text");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoContext, setPhotoContext] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [inputMethod, setInputMethod] = useState<"text" | "photo" | "manual">("manual");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overallConfidence, setOverallConfidence] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  const timezone = profile?.timezone ?? "UTC";

  const handlePhotoSelect = (file: File | null) => {
    setError(null);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!isSupportedImageType(file)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const startManualEntry = () => {
    setDraft({
      mealName: "",
      mealType: "snack",
      mealDate: todayInTimezone(timezone),
      mealTime: nowTimeInTimezone(timezone),
      notes: "",
      items: [emptyItem()]
    });
    setInputMethod("manual");
    setAiUsed(false);
    setOverallConfidence(null);
    setWarnings([]);
    setStep("review");
  };

  const analyzeText = async () => {
    if (!description.trim()) return;
    setStep("analyzing");
    setError(null);
    try {
      const result = await api.post<AiAnalysisResult>("/api/analyze/text", { description });
      setDraft(aiResultToDraft(result, todayInTimezone(timezone), nowTimeInTimezone(timezone)));
      setInputMethod("text");
      setAiUsed(true);
      setOverallConfidence(result.overallConfidence);
      setWarnings(result.warnings);
      setStep("review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't analyze this meal right now. Please try again or enter the nutrition details manually.");
      setStep("input");
    }
  };

  const analyzePhoto = async () => {
    if (!photoFile) return;
    setStep("analyzing");
    setError(null);
    try {
      const { dataUrl, mimeType } = await resizeAndCompressImage(photoFile);
      const result = await api.post<AiAnalysisResult>("/api/analyze/image", { imageBase64: dataUrl, mimeType, context: photoContext });
      setDraft(aiResultToDraft(result, todayInTimezone(timezone), nowTimeInTimezone(timezone)));
      setInputMethod("photo");
      setAiUsed(true);
      setOverallConfidence(result.overallConfidence);
      setWarnings(result.warnings);
      setStep("review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't analyze this meal right now. Please try again or enter the nutrition details manually.");
      setStep("input");
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.post("/api/meals", {
        mealName: draft.mealName,
        mealType: draft.mealType,
        mealDate: draft.mealDate,
        mealTime: draft.mealTime,
        inputMethod,
        originalText: inputMethod === "text" ? description : null,
        notes: draft.notes || null,
        aiModel: aiUsed ? "gpt-5-nano" : null,
        overallConfidence,
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
      showToast("Meal saved.");
      navigate("/today");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not save this meal. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (step === "review" && draft) {
    return (
      <div className="stack">
        <div className="app-topbar">
          <h1>Review meal</h1>
        </div>
        <MealEditor
          draft={draft}
          onChange={setDraft}
          showEstimateBanner={aiUsed}
          warnings={warnings}
          onSave={handleSave}
          onCancel={() => navigate("/today")}
          saving={saving}
          saveLabel="Confirm and save"
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="app-topbar">
        <h1>Add Meal</h1>
      </div>

      <div className="tabbar" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "text"} onClick={() => setTab("text")}>
          <Icon name="text" size={16} /> Describe
        </button>
        <button type="button" role="tab" aria-selected={tab === "photo"} onClick={() => setTab("photo")}>
          <Icon name="camera" size={16} /> Photo
        </button>
      </div>

      {step === "analyzing" ? (
        <div className="card state-panel">
          <Icon name="sparkle" />
          <h3>Analyzing your meal...</h3>
          <p className="text-sm text-muted">GPT-5 Nano is estimating portions and nutrition. This takes a few seconds.</p>
        </div>
      ) : tab === "text" ? (
        <div className="card stack">
          <div className="field">
            <label htmlFor="meal-description">What did you eat?</label>
            <textarea
              id="meal-description"
              className="textarea"
              rows={5}
              placeholder="e.g. Two idlis with one bowl of sambar and coconut chutney."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <span className="field-hint">Mention portion sizes, sauces, oils, or preparation for a better estimate.</span>
          </div>
          {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
          <button type="button" className="btn btn-primary" disabled={!description.trim()} onClick={analyzeText}>
            <Icon name="sparkle" size={16} /> Analyze meal
          </button>
        </div>
      ) : (
        <div className="card stack">
          {photoPreview ? (
            <div className="photo-preview-wrap">
              <img src={photoPreview} alt="Selected meal" />
              <button type="button" className="photo-remove-btn" aria-label="Remove photo" onClick={() => handlePhotoSelect(null)}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className="photo-dropzone" onClick={() => fileInputRef.current?.click()}>
              <Icon name="camera" size={32} />
              <span>Tap to take or choose a photo</span>
              <span className="text-xs text-faint">JPEG, PNG or WebP, up to 5MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="visually-hidden"
            onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
          />

          <div className="field">
            <label htmlFor="photo-context">Optional context</label>
            <input
              id="photo-context"
              className="input"
              placeholder="e.g. The curry was made with coconut milk."
              value={photoContext}
              onChange={(e) => setPhotoContext(e.target.value)}
            />
          </div>

          {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
          <button type="button" className="btn btn-primary" disabled={!photoFile} onClick={analyzePhoto}>
            <Icon name="sparkle" size={16} /> Analyze photo
          </button>
        </div>
      )}

      <button type="button" className="btn btn-ghost btn-block" onClick={startManualEntry}>
        Enter nutrition details manually instead
      </button>
    </div>
  );
}
