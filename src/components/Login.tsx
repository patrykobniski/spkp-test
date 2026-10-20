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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("invalid_password") || msg.includes("401")) {
        setError("Nieprawidłowe hasło.");
      } else if (msg.includes("too_many")) {
        setError("Za dużo prób. Poczekaj chwilę.");
      } else {
        setError("Błąd sieci lub serwera. Spróbuj ponownie.");
      }
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
            className="mobile-input"
            type="text"
            inputMode="text"
            enterKeyHint="go"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
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
