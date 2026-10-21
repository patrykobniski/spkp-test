/**
 * Sygnały minutnika.
 * Opera: odblokowanie przy geście + cichy keep-alive (bez słyszalnego loopa).
 * Odliczanie: krótki tick na 3 / 2 / 1 s, pełny sygnał na 0.
 */

const STORAGE_KEY = "spkp_sound_ok";

let unlocked = false;
let silentKeep: HTMLAudioElement | null = null;
let beepEl: HTMLAudioElement | null = null;

function assetUrl(file: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${file}`;
}

/** Prawdziwa cisza — 0.5 s mono, żeby Opera trzymała sesję audio. */
function silentDataUri(): string {
  const sampleRate = 8000;
  const n = sampleRate; // 1 s
  const data = new Uint8Array(44 + n * 2);
  const view = new DataView(data.buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, n * 2, true);
  // samples already 0
  const blob = new Blob([data], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function ensureElements(): { silent: HTMLAudioElement; beep: HTMLAudioElement } {
  if (!silentKeep) {
    silentKeep = new Audio(silentDataUri());
    silentKeep.loop = true;
    silentKeep.preload = "auto";
    silentKeep.volume = 0.01;
    silentKeep.setAttribute("playsinline", "true");
  }
  if (!beepEl) {
    beepEl = new Audio(assetUrl("beep.wav"));
    beepEl.preload = "auto";
    beepEl.volume = 1;
    beepEl.setAttribute("playsinline", "true");
  }
  return { silent: silentKeep, beep: beepEl };
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1" || unlocked;
  } catch {
    return unlocked;
  }
}

export function markSoundEnabled(): void {
  unlocked = true;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
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
    /* ignore */
  }
}

function speakTime(): void {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Czas");
    u.lang = "pl-PL";
    u.rate = 1.15;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export async function enableSound(): Promise<{ ok: boolean; error?: string }> {
  const { silent, beep } = ensureElements();
  try {
    silent.currentTime = 0;
    await silent.play();
    silent.pause();
    silent.currentTime = 0;

    beep.currentTime = 0;
    beep.volume = 1;
    await beep.play();
    speakTime();
    tryVibrate([180, 80, 180]);
    markSoundEnabled();
    unlocked = true;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** Cichy keep-alive w geście Start — bez słyszalnego loopa. */
export async function beginRestAudio(): Promise<void> {
  const { silent } = ensureElements();
  try {
    silent.pause();
    silent.currentTime = 0;
    silent.volume = 0.01;
    await silent.play();
    unlocked = true;
  } catch {
    /* UI: Włącz dźwięk */
  }
  tryVibrate(30);
}

export function stopRestAudio(): void {
  try {
    silentKeep?.pause();
    if (silentKeep) silentKeep.currentTime = 0;
  } catch {
    /* ignore */
  }
}

/** Krótki tick (ostatnie 3 / 2 / 1 s). */
export async function playCountdownTick(): Promise<void> {
  const { beep } = ensureElements();
  try {
    beep.pause();
    beep.currentTime = 0;
    beep.volume = 0.55;
    await beep.play();
  } catch {
    /* ignore */
  }
  tryVibrate(40);
}

/** Koniec przerwy (0 s). */
export async function playAlert(): Promise<void> {
  stopRestAudio();
  tryVibrate([240, 100, 240, 100, 360]);
  speakTime();

  const { beep } = ensureElements();
  try {
    beep.pause();
    beep.currentTime = 0;
    beep.volume = 1;
    await beep.play();
    window.setTimeout(() => {
      try {
        beep.currentTime = 0;
        void beep.play();
      } catch {
        /* ignore */
      }
    }, 280);
    window.setTimeout(() => {
      try {
        beep.currentTime = 0;
        void beep.play();
      } catch {
        /* ignore */
      }
    }, 560);
    markSoundEnabled();
  } catch {
    speakTime();
  }
}

export async function unlockAudio(): Promise<void> {
  if (isSoundEnabled()) {
    await beginRestAudio().catch(() => undefined);
    stopRestAudio();
    return;
  }
  await enableSound();
}
