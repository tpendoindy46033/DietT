import { useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { api, ApiError } from "../lib/api";

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/login", { password });
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-brand-icon">
            <Icon name="leaf" />
          </div>
          <h1>AI Diet Manager</h1>
          <p className="text-sm text-muted">Sign in to your personal food tracker.</p>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && (
          <div className="row" style={{ color: "var(--color-danger)" }}>
            <Icon name="warning" size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !password}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
