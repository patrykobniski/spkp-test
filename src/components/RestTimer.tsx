import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { playAlert, tryVibrate, unlockAudio } from "../lib/feedback";

const PRESETS = [45, 90, 120, 180];

export type RestTimerHandle = {
  /** Wywołać w tym samym kliknięciu co odhaczenie serii (gest → dźwięk w Operze). */
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
  const endAt = useRef<number | null>(null);
  const beeped = useRef(false);
  const running = remaining != null;

  useImperativeHandle(ref, () => ({
    startFromGesture(sec = 90) {
      void unlockAudio();
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
      if (left <= 0 && !beeped.current) {
        beeped.current = true;
        void playAlert();
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

  async function startWithGesture(sec: number) {
    await unlockAudio();
    tryVibrate(40);
    start(sec);
  }

  const overdue = remaining != null && remaining < 0;
  const fabLabel = remaining != null ? formatSignedSeconds(remaining) : `${seconds}s`;

  return (
    <>
      {!open && (
        <button
          type="button"
          className={`rest-fab${overdue ? " overdue" : ""}${running ? " running" : ""}`}
          aria-label="Minutnik przerwy"
          onClick={() => {
            void unlockAudio();
            setOpen(true);
            if (overdue) void playAlert();
          }}
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
            <button
              type="button"
              onClick={() => {
                void unlockAudio();
                void playAlert();
              }}
              aria-label="Test dźwięku i wibracji"
              title="Test dźwięku"
            >
              🔊
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
