import { useEffect, useState } from "react";
import type { WeightEntry, WeightUnit } from "@shared/types";
import { Modal, ConfirmDialog } from "./Modal";
import { Icon } from "./Icon";
import { api, ApiError } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { todayInTimezone, formatDateLabel } from "../lib/dates";
import { useToast } from "../lib/ToastContext";

export function WeightModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useProfile();
  const { showToast } = useToast();
  const timezone = profile?.timezone ?? "UTC";

  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile?.weightUnit ?? "kg");
  const [recordedDate, setRecordedDate] = useState(todayInTimezone(timezone));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ weights: WeightEntry[] }>("/api/weights");
      setEntries(data.weights.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load weight history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setWeightValue("");
    setWeightUnit(profile?.weightUnit ?? "kg");
    setRecordedDate(todayInTimezone(timezone));
    setNotes("");
  };

  const startEdit = (entry: WeightEntry) => {
    setEditingId(entry.id);
    setWeightValue(String(entry.weightValue));
    setWeightUnit(entry.weightUnit);
    setRecordedDate(entry.recordedDate);
    setNotes(entry.notes ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(weightValue);
    if (!Number.isFinite(value) || value <= 0) {
      showToast("Enter a valid weight.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { weightValue: value, weightUnit, recordedDate, notes: notes || null };
      if (editingId) {
        await api.put(`/api/weights/${editingId}`, payload);
        showToast("Weight entry updated.");
      } else {
        await api.post("/api/weights", payload);
        showToast("Weight logged.");
      }
      resetForm();
      await loadEntries();
      onSaved();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not save that entry.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    try {
      await api.delete(`/api/weights/${id}`);
      showToast("Weight entry deleted.");
      await loadEntries();
      onSaved();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not delete that entry.", "error");
    }
  };

  return (
    <Modal title="Weight" onClose={onClose}>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="form-row form-row-2">
          <div className="field">
            <label htmlFor="weight-value">Weight</label>
            <input
              id="weight-value"
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="weight-unit">Unit</label>
            <select id="weight-unit" className="select" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="weight-date">Date</label>
          <input id="weight-date" className="input" type="date" value={recordedDate} onChange={(e) => setRecordedDate(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="weight-notes">Notes (optional)</label>
          <input id="weight-notes" className="input" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {editingId ? "Save changes" : "Log weight"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="stack" style={{ marginTop: "var(--space-5)" }}>
        <div className="settings-section-title">Recent entries</div>
        {loading && <p className="text-sm text-muted">Loading...</p>}
        {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
        {!loading && entries.length === 0 && <p className="text-sm text-muted">No weight entries yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="row-between" style={{ padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)" }}>
            <div>
              <div className="text-sm tabular">
                {entry.weightValue} {entry.weightUnit}
              </div>
              <div className="text-xs text-faint">{formatDateLabel(entry.recordedDate)}</div>
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Edit entry" onClick={() => startEdit(entry)}>
                <Icon name="edit" size={16} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Delete entry" onClick={() => setConfirmDeleteId(entry.id)}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete weight entry?"
          message="This weight entry will be permanently removed."
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(confirmDeleteId)}
        />
      )}
    </Modal>
  );
}
