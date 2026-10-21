import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import {
  beginRestAudio,
  enableSound,
  isSoundEnabled,
  playAlert,
  playCountdownTick,
  stopRestAudio,
  tryVibrate,
} from "../lib/feedback";

const PRESETS = [45, 90, 120, 180];

export type RestTimerHandle = {
  startFromGesture: (sec?: number) => void;
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

export const RestTimer = forwardRef<RestTimerHandle>(function RestTimer(_props, ref) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(90);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [readyAtLabel, setReadyAtLabel] = useState<string | null>(null);
  const [soundOk, setSoundOk] = useState(() => isSoundEnabled());
  const [soundMsg, setSoundMsg] = useState<string | null>(null);
  const endAt = useRef<number | null>(null);
  const finalBeeped = useRef(false);
  const tickDone = useRef<Set<number>>(new Set());
  const running = remaining != null;

  useImperativeHandle(ref, () => ({
    startFromGesture(sec = 90) {
      void beginRestAudio();
      tryVibrate(40);
      start(sec);
    },
  }));

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!endAt.current) return;
      const left = Math.ceil((endAt.current - Date.now()) / 1000);
      setRemaining(left);

      // Tylko ostatnie 3 sekundy: tick na 3, 2, 1
      if (left === 3 || left === 2 || left === 1) {
        if (!tickDone.current.has(left)) {
          tickDone.current.add(left);
          void playCountdownTick();
        }
      }

      if (left <= 0 && !finalBeeped.current) {
        finalBeeped.current = true;
        void playAlert();
      }
    }, 200);
    return () => clearInterval(id);
  }, [running]);

  function start(sec: number) {
    const end = Date.now() + sec * 1000;
    setSeconds(sec);
    endAt.current = end;
    finalBeeped.current = false;
    tickDone.current = new Set();
    setReadyAtLabel(formatClock(end));
    setRemaining(sec);
    setOpen(true);
  }

  function stop() {
    endAt.current = null;
    finalBeeped.current = false;
    tickDone.current = new Set();
    setRemaining(null);
    setReadyAtLabel(null);
    stopRestAudio();
  }

  async function startWithGesture(sec: number) {
    await beginRestAudio();
    tryVibrate(40);
    start(sec);
  }

  async function onEnableSound() {
    setSoundMsg(null);
    const res = await enableSound();
    if (res.ok) {
      setSoundOk(true);
      setSoundMsg("Słyszysz sygnał? Dźwięk włączony.");
    } else {
      setSoundOk(false);
      setSoundMsg(
        "Opera zablokowała dźwięk. Wejdź w ustawienia witryny (ikona przy adresie) → Dźwięk → Zezwól, potem kliknij tu ponownie.",
      );
    }
  }

  const overdue = remaining != null && remaining < 0;
  const fabLabel = remaining != null ? formatSignedSeconds(remaining) : `${seconds}s`;

  return (
    <>
      {!open && (
        <button
          type="button"
          className={`rest-fab${overdue ? " overdue" : ""}${running ? " running" : ""}${!soundOk ? " needs-sound" : ""}`}
          aria-label="Minutnik przerwy"
          onClick={() => setOpen(true)}
        >
          {!soundOk ? "🔊?" : fabLabel}
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

          {!soundOk && (
            <div className="rest-sound-gate">
              <p>
                Opera domyślnie blokuje dźwięk stron. Włącz go jednym tapnięciem:
              </p>
              <button type="button" className="primary" onClick={() => void onEnableSound()}>
                Włącz dźwięk minutnika
              </button>
              <ol className="rest-sound-help">
                <li>Ikona przy adresie strony (kłódka / i)</li>
                <li>Uprawnienia / Ustawienia witryny</li>
                <li>
                  <strong>Dźwięk → Zezwól</strong>
                </li>
                <li>Wróć i kliknij przycisk powyżej</li>
              </ol>
            </div>
          )}

          {soundMsg && (
            <p className={`rest-sound-msg${soundOk ? "" : " error"}`}>{soundMsg}</p>
          )}

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
                onClick={() => void startWithGesture(p)}
                aria-label={`${p} sekund`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="ex-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void startWithGesture(seconds)}
            >
              Start
            </button>
            <button type="button" onClick={() => void onEnableSound()} aria-label="Test dźwięku">
              🔊 Test
            </button>
            <button type="button" onClick={stop}>
              Stop
            </button>
          </div>
        </div>
      )}
    </>
  );
});
