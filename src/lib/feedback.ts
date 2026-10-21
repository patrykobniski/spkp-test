/** Odblokowanie audio / sygnały — Opera i Safari wymagają gestu użytkownika. */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Wywołać synchronicznie w obsłudze kliknięcia (odhacz seria / Start). */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    // cichy „tick”, żeby Opera trzymała kontekst odblokowany
    const g = c.createGain();
    g.gain.value = 0.0001;
    const o = c.createOscillator();
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
    unlocked = true;
  } catch {
    /* ignore */
  }
}

export function tryVibrate(pattern: number | number[] = [200, 100, 200]): void {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(0);
      navigator.vibrate(pattern);
    }
  } catch {
    /* Opera desktop / polityka przeglądarki */
  }
}

/** Krótki WAV (beep) — fallback gdy Web Audio jest zawieszony. */
function playHtmlBeep(): void {
  // 880 Hz, ~0.2 s, mono 8-bit
  const sampleRate = 16000;
  const duration = 0.2;
  const n = Math.floor(sampleRate * duration);
  const data = new Uint8Array(44 + n);
  const view = new DataView(data.buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + n, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 30) * Math.min(1, (duration - t) * 30);
    const sample = 128 + Math.sin(2 * Math.PI * 880 * t) * 70 * env;
    data[44 + i] = Math.max(0, Math.min(255, sample | 0));
  }
  const blob = new Blob([data], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = 1;
  void audio.play().finally(() => URL.revokeObjectURL(url));
}

async function playWebBeep(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    const now = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "square";
      o.frequency.value = i === 2 ? 1175 : 880;
      o.connect(g);
      g.connect(c.destination);
      const t0 = now + i * 0.2;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0);
      o.stop(t0 + 0.17);
    }
    return true;
  } catch {
    return false;
  }
}

export async function playAlert(): Promise<void> {
  await unlockAudio();
  const ok = await playWebBeep();
  if (!ok) {
    try {
      playHtmlBeep();
      window.setTimeout(() => playHtmlBeep(), 220);
      window.setTimeout(() => playHtmlBeep(), 440);
    } catch {
      /* ignore */
    }
  }
  tryVibrate([220, 100, 220, 100, 320]);
}

export function isAudioUnlocked(): boolean {
  return unlocked && !!ctx && ctx.state === "running";
}
