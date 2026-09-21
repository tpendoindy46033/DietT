import { useEffect, useState } from "react";
import type { Profile, WeightUnit } from "@shared/types";
import { useProfile } from "../lib/ProfileContext";
import { Icon } from "../components/Icon";
import { SkeletonPage } from "../components/Skeleton";
import { useToast } from "../lib/ToastContext";
import { api } from "../lib/api";

function listTimezones(): string[] {
  const intlWithSupportedValues = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    return intlWithSupportedValues.supportedValuesOf ? intlWithSupportedValues.supportedValuesOf("timeZone") : ["UTC"];
  } catch {
    return ["UTC"];
  }
}

const COMMON_TIMEZONES = listTimezones();

export function SettingsPage() {
  const { profile, loading, updateProfile } = useProfile();
  const { showToast } = useToast();
  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  if (loading || !form) return <SkeletonPage />;

  const handleChange = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateProfile(form);
      showToast("Settings saved.");
    } catch {
      showToast("Could not save your settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/export", { credentials: "include" });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diet-manager-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Could not export your data.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    window.location.href = "/login";
  };

  return (
    <div className="stack">
      <div className="app-topbar">
        <h1>Settings</h1>
      </div>

      <div className="card settings-section">
        <span className="settings-section-title">Profile</span>
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" className="input" value={form.displayName} onChange={(e) => handleChange("displayName", e.target.value)} />
        </div>
        <div className="form-row form-row-2">
          <div className="field">
            <label htmlFor="timezone">Time zone</label>
            <select id="timezone" className="select" value={form.timezone} onChange={(e) => handleChange("timezone", e.target.value)}>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="weight-unit-setting">Weight unit</label>
            <select
              id="weight-unit-setting"
              className="select"
              value={form.weightUnit}
              onChange={(e) => handleChange("weightUnit", e.target.value as WeightUnit)}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card settings-section">
        <span className="settings-section-title">Daily targets</span>
        <div className="form-row form-row-2">
          <TargetField label="Calories (kcal)" value={form.calorieTarget} onChange={(v) => handleChange("calorieTarget", v)} />
          <TargetField label="Protein (g)" value={form.proteinTarget} onChange={(v) => handleChange("proteinTarget", v)} />
        </div>
        <div className="form-row form-row-2">
          <TargetField label="Carbohydrates (g)" value={form.carbohydrateTarget} onChange={(v) => handleChange("carbohydrateTarget", v)} />
          <TargetField label="Fat (g)" value={form.fatTarget} onChange={(v) => handleChange("fatTarget", v)} />
        </div>
        <div className="form-row form-row-2">
          <TargetField label="Fiber (g)" value={form.fiberTarget} onChange={(v) => handleChange("fiberTarget", v)} />
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>

      <div className="card settings-section">
        <span className="settings-section-title">Your data</span>
        <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
          <Icon name="export" size={16} /> {exporting ? "Preparing export..." : "Export my data (JSON)"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          <Icon name="logout" size={16} /> Log out
        </button>
      </div>

      <p className="disclaimer">
        This application is a general food-tracking tool and does not provide medical advice. AI-generated calorie and nutrition
        estimates may be inaccurate. Consult a qualified healthcare professional for medical or dietary guidance.
      </p>
    </div>
  );
}

function TargetField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = `target-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input tabular"
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}
