import type { Exercise, MaxValues } from "../types";

/** Detect exercise family for M/N/O keys. */
export function maxFamily(exerciseName: string): "pompki" | "podciaganie" | null {
  const n = exerciseName.toLowerCase();
  if (n.includes("pompk")) return "pompki";
  if (n.includes("podciąganie") || n.includes("podciaganie")) return "podciaganie";
  return null;
}

export function maxKey(letter: "M" | "N" | "O", family: "pompki" | "podciaganie"): string {
  return `${family}_${letter}`;
}

/** Is this planned set a MAX seed that stores M/N/O? */
export function parseMaxSeed(planned: string): { letter: "M" | "N" | "O" } | null {
  const t = planned.trim();
  if (/^MAX\s+w\b/i.test(t)) return null;
  const m = t.match(/^MAX(?:\s*\(([MNO])\))?$/i);
  if (!m) return null;
  if (m[1]) return { letter: m[1].toUpperCase() as "M" | "N" | "O" };
  // Bare "MAX" — pull-up session 14 → M
  return { letter: "M" };
}

export type ResolvedGoal = {
  display: string;
  primaryNumber: number | null;
  needsMax: boolean;
  letter: "M" | "N" | "O" | null;
};

/**
 * Resolve goals like "M−4", "M−7+2", "M-1 +5x", "N+1+5x", "M".
 * Shows e.g. "M−4 = 13". Leaves plain targets unchanged.
 */
export function resolveGoal(
  planned: string,
  family: "pompki" | "podciaganie" | null,
  maxes: MaxValues,
): ResolvedGoal {
  const seed = parseMaxSeed(planned);
  if (seed) {
    return {
      display: planned,
      primaryNumber: null,
      needsMax: false,
      letter: seed.letter,
    };
  }

  if (!family) {
    return { display: planned, primaryNumber: null, needsMax: false, letter: null };
  }

  const trimmed = planned.trim();
  // M / N / O as training variable at start
  const head = trimmed.match(/^([MNO])(?=$|[\s+−–—-])/);
  if (!head) {
    return { display: planned, primaryNumber: null, needsMax: false, letter: null };
  }

  const letter = head[1] as "M" | "N" | "O";
  let rest = trimmed.slice(1);

  // First ±N is arithmetic unless followed by "x" (e.g. "+5x" is a literal suffix).
  let valueDelta: { op: "+" | "-"; n: number } | null = null;
  const arith = rest.match(/^\s*([+−–—-])\s*(\d+)(?![xX\d])/);
  if (arith) {
    const op: "+" | "-" = arith[1] === "+" ? "+" : "-";
    valueDelta = { op, n: Number(arith[2]) };
    rest = rest.slice(arith[0].length);
  }

  const suffix = rest; // e.g. "+2", " +5x", "+5x", ""

  const key = maxKey(letter, family);
  const base = maxes[key];
  if (base == null || Number.isNaN(Number(base))) {
    return {
      display: planned,
      primaryNumber: null,
      needsMax: true,
      letter,
    };
  }

  let value = Number(base);
  if (valueDelta) {
    value = valueDelta.op === "-" ? value - valueDelta.n : value + valueDelta.n;
  }

  const suffixPart = suffix.trimStart();
  const keepSpace = suffix.startsWith(" ") && suffixPart.length > 0;
  const eq = suffixPart
    ? `${value}${keepSpace ? " " : ""}${suffixPart}`
    : String(value);

  return {
    display: `${planned} = ${eq}`.replace(/\s+/g, " ").trim(),
    primaryNumber: value,
    needsMax: false,
    letter,
  };
}

export function resolveExerciseGoals(
  exercise: Exercise,
  maxes: MaxValues,
): ResolvedGoal[] {
  const family = maxFamily(exercise.name);
  return exercise.plannedSets.map((s) => resolveGoal(s, family, maxes));
}

export function parseRepsNumber(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const m = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round(Number(m[1]));
}
