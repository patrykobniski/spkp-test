import { useEffect, useRef, useState } from "react";

const PRESETS = [45, 90, 120, 180];

type Props = {
  autoStartToken: number;
};

export function RestTimer({ autoStartToken }: Props) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(90);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    if (autoStartToken <= 0) return;
    setSeconds(90);
    endAt.current = Date.now() + 90_000;
    setRemaining(90);
    setOpen(true);
  }, [autoStartToken]);

  useEffect(() => {
    if (remaining == null) return;
    const id = window.setInterval(() => {
      if (!endAt.current) return;
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        endAt.current = null;
        setRemaining(null);
        try {
          const ctx = new AudioContext();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.value = 0.05;
          o.start();
          o.stop(ctx.currentTime + 0.25);
        } catch {
          /* ignore */
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 200);
    return () => clearInterval(id);
  }, [remaining]);

  function start(sec: number) {
    setSeconds(sec);
    endAt.current = Date.now() + sec * 1000;
    setRemaining(sec);
    setOpen(true);
  }

  function stop() {
    endAt.current = null;
    setRemaining(null);
  }

  const label = remaining != null ? String(remaining) : String(seconds);

  return (
    <>
      <button
        type="button"
        className="rest-fab"
        aria-label="Minutnik przerwy"
        onClick={() => setOpen((v) => !v)}
      >
        {label}s
      </button>
      {open && (
        <div className="rest-panel" role="dialog" aria-label="Minutnik przerwy">
          <div className="rest-time">{remaining != null ? remaining : seconds}s</div>
          <div className="rest-presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => start(p)} aria-label={`${p} sekund`}>
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
