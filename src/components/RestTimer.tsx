import { useEffect, useRef, useState } from "react";

const PRESETS = [45, 90, 120, 180];

type Props = {
  autoStartToken: number;
};

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSignedSeconds(sec: number): string {
  if (sec >= 0) return `${sec}s`;
  return `−${Math.abs(sec)}s`;
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = i === 2 ? 1046 : 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = now + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.start(t0);
      o.stop(t0 + 0.15);
    }
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* ignore */
  }
  if (navigator.vibrate) navigator.vibrate([180, 80, 180, 80, 280]);
}

export function RestTimer({ autoStartToken }: Props) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(90);
  /** null = stoi; liczba (też ujemna) = leci / po czasie */
  const [remaining, setRemaining] = useState<number | null>(null);
  const [readyAtLabel, setReadyAtLabel] = useState<string | null>(null);
  const endAt = useRef<number | null>(null);
  const beeped = useRef(false);
  const running = remaining != null;

  useEffect(() => {
    if (autoStartToken <= 0) return;
    start(90);
  }, [autoStartToken]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!endAt.current) return;
      const left = Math.ceil((endAt.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0 && !beeped.current) {
        beeped.current = true;
        playBeep();
      }
    }, 200);
    return () => clearInterval(id);
  }, [running]);

  function start(sec: number) {
    const end = Date.now() + sec * 1000;
    setSeconds(sec);
    endAt.current = end;
    beeped.current = false;
    setReadyAtLabel(formatClock(end));
    setRemaining(sec);
    setOpen(true);
  }

  function stop() {
    endAt.current = null;
    beeped.current = false;
    setRemaining(null);
    setReadyAtLabel(null);
  }

  const overdue = remaining != null && remaining < 0;
  const fabLabel = remaining != null ? formatSignedSeconds(remaining) : `${seconds}s`;

  return (
    <>
      {/* FAB tylko gdy panel zwinięty — nie zasłania zegara */}
      {!open && (
        <button
          type="button"
          className={`rest-fab${overdue ? " overdue" : ""}${running ? " running" : ""}`}
          aria-label="Minutnik przerwy"
          onClick={() => setOpen(true)}
        >
          {fabLabel}
        </button>
      )}

      {open && (
        <div
          className={`rest-panel${overdue ? " overdue" : ""}`}
          role="dialog"
          aria-label="Minutnik przerwy"
        >
          <div className="rest-panel-head">
            <span className="rest-panel-title">Przerwa</span>
            <button
              type="button"
              className="rest-collapse"
              aria-label="Zwiń minutnik"
              onClick={() => setOpen(false)}
            >
              Zwiń
            </button>
          </div>

          <div className={`rest-time${overdue ? " overdue" : ""}`}>
            {remaining != null ? formatSignedSeconds(remaining) : `${seconds}s`}
          </div>

          {readyAtLabel && running && (
            <p className="rest-ready-at">
              {overdue ? "Po czasie · start był o " : "Ćwicz o "}
              <strong>{readyAtLabel}</strong>
            </p>
          )}

          <div className="rest-presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => start(p)}
                aria-label={`${p} sekund`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="ex-actions">
            <button type="button" className="primary" onClick={() => start(seconds)}>
              Start
            </button>
            <button type="button" onClick={stop}>
              Stop
            </button>
          </div>
        </div>
      )}
    </>
  );
}
