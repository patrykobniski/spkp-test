/**
 * Sygnały minutnika.
 * Opera często blokuje play() po setTimeout — trzymamy cichy keep-alive
 * od gestu Start i na końcu gramy głośny beep + SpeechSynthesis.
 */

const STORAGE_KEY = "spkp_sound_ok";

let unlocked = false;
let keepAlive: HTMLAudioElement | null = null;
let beepEl: HTMLAudioElement | null = null;

function beepUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}beep.wav`;
}

function ensureElements(): { keep: HTMLAudioElement; beep: HTMLAudioElement } {
  if (!keepAlive) {
    keepAlive = new Audio(beepUrl());
    keepAlive.loop = true;
    keepAlive.preload = "auto";
    keepAlive.volume = 0.001;
    keepAlive.setAttribute("playsinline", "true");
  }
  if (!beepEl) {
    beepEl = new Audio(beepUrl());
    beepEl.preload = "auto";
    beepEl.volume = 1;
    beepEl.setAttribute("playsinline", "true");
  }
  return { keep: keepAlive, beep: beepEl };
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
    /* Opera desktop / polityka */
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

/** Odblokuj + potwierdź dźwiękiem — wywołać przy tapnięciu „Włącz dźwięk”. */
export async function enableSound(): Promise<{ ok: boolean; error?: string }> {
  const { keep, beep } = ensureElements();
  try {
    keep.currentTime = 0;
    keep.volume = 0.001;
    await keep.play();
    keep.pause();
    keep.currentTime = 0;

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

/**
 * Start przerwy — w tym samym geście co Start / odhaczenie.
 * Uruchamia cichy keep-alive, żeby Opera pozwoliła zagrać na końcu.
 */
export async function beginRestAudio(): Promise<void> {
  const { keep } = ensureElements();
  try {
    keep.pause();
    keep.currentTime = 0;
    keep.volume = 0.001;
    await keep.play();
    unlocked = true;
  } catch {
    // spróbuj jeszcze raz po enableSound w UI
  }
  tryVibrate(30);
}

export function stopRestAudio(): void {
  try {
    keepAlive?.pause();
    if (keepAlive) keepAlive.currentTime = 0;
  } catch {
    /* ignore */
  }
}

/** Koniec przerwy — głośny sygnał (działa najlepiej po beginRestAudio). */
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
    // ostatnia deska: speech już poszło
    speakTime();
  }
}

/** Alias wstecznej kompatybilności */
export async function unlockAudio(): Promise<void> {
  if (isSoundEnabled()) {
    await beginRestAudio().catch(() => undefined);
    stopRestAudio();
    return;
  }
  await enableSound();
}
