import type { Exercise, PlanDay, SetLog } from "../types";

export function setsForExercise(
  logs: SetLog[],
  week: number,
  dayIndex: number,
  exerciseOrder: number,
): SetLog[] {
  return logs
    .filter(
      (s) =>
        s.week === week &&
        s.day_index === dayIndex &&
        s.exercise_order === exerciseOrder,
    )
    .sort((a, b) => a.set_index - b.set_index);
}

export function exerciseDoneCount(
  logs: SetLog[],
  week: number,
  dayIndex: number,
  exercise: Exercise,
): { done: number; total: number } {
  const rows = setsForExercise(logs, week, dayIndex, exercise.order);
  const planned = exercise.singleResult ? 1 : exercise.plannedSets.length;
  const maxIndex = rows.reduce((m, r) => Math.max(m, r.set_index), planned - 1);
  const total = Math.max(planned, maxIndex + 1);
  const done = rows.filter((r) => r.done === 1).length;
  return { done, total };
}

export function dayDoneCount(
  logs: SetLog[],
  week: number,
  day: PlanDay,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of day.exercises) {
    const p = exerciseDoneCount(logs, week, day.dayIndex, ex);
    done += p.done;
    total += p.total;
  }
  return { done, total };
}

/** Last session of same exercise name on same weekday in earlier weeks. */
export function previousHistoryLine(
  planExerciseName: string,
  week: number,
  dayIndex: number,
  allSets: SetLog[],
  exerciseOrdersByWeek: Map<string, number>,
): string | null {
  for (let w = week - 1; w >= 1; w--) {
    const key = `${w}:${dayIndex}:${planExerciseName}`;
    const order = exerciseOrdersByWeek.get(key);
    if (order == null) continue;
    const rows = setsForExercise(allSets, w, dayIndex, order).filter((r) => r.done === 1);
    if (rows.length === 0) continue;

    const parts = rows.map((r) => {
      if (r.result_text) return r.result_text;
      return r.reps ?? "✓";
    });
    const weights = rows.map((r) => r.weight_kg).filter((x): x is number => x != null);
    const weightPart =
      weights.length > 0 ? ` · ${weights[weights.length - 1]} kg` : "";
    return `Tydz. ${w}: ${parts.join("/")}${weightPart}`;
  }
  return null;
}

export function lastWeightPlaceholder(
  planExerciseName: string,
  week: number,
  dayIndex: number,
  allSets: SetLog[],
  exerciseOrdersByWeek: Map<string, number>,
): number | null {
  for (let w = week; w >= 1; w--) {
    const key = `${w}:${dayIndex}:${planExerciseName}`;
    const order = exerciseOrdersByWeek.get(key);
    if (order == null) continue;
    const rows = setsForExercise(allSets, w, dayIndex, order);
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].weight_kg != null) return rows[i].weight_kg;
    }
  }
  return null;
}

export function buildExerciseOrderIndex(
  weeks: { week: number; days: PlanDay[] }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of weeks) {
    for (const d of w.days) {
      for (const e of d.exercises) {
        map.set(`${w.week}:${d.dayIndex}:${e.name}`, e.order);
      }
    }
  }
  return map;
}
