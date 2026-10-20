import { useState, type FormEvent } from "react";
import { login } from "../api/client";

type Props = {
  onSuccess: () => void;
};

export function Login({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch {
      setError("Nieprawidłowe hasło lub błąd serwera.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Dziennik SPKP</h1>
        <p className="muted">12 tygodni · jeden użytkownik</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="password">Hasło</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="save-status error">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Logowanie…" : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
