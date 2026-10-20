import type { Exercise, MaxValues, SetLog } from "../types";
import {
  maxFamily,
  maxKey,
  parseMaxSeed,
  parseRepsNumber,
  resolveGoal,
} from "../lib/resolveGoal";
import { setsForExercise } from "../lib/progress";
import { MobileField } from "./MobileField";

type Props = {
  week: number;
  dayIndex: number;
  exercise: Exercise;
  logs: SetLog[];
  maxes: MaxValues;
  historyLine: string | null;
  weightPlaceholder: number | null;
  onChangeSet: (set: SetLog & { max_key?: string; max_value?: number; max_source?: string }) => void;
  onDeleteSet: (setIndex: number) => void;
  onSetDone: () => void;
};

function emptySet(
  week: number,
  dayIndex: number,
  exercise: Exercise,
  setIndex: number,
  isExtra: boolean,
): SetLog {
  return {
    week,
    day_index: dayIndex,
    exercise_order: exercise.order,
    set_index: setIndex,
    is_extra: isExtra ? 1 : 0,
    done: 0,
    reps: null,
    weight_kg: null,
    result_text: null,
  };
}

export function ExerciseCard({
  week,
  dayIndex,
  exercise,
  logs,
  maxes,
  historyLine,
  weightPlaceholder,
  onChangeSet,
  onDeleteSet,
  onSetDone,
}: Props) {
  const existing = setsForExercise(logs, week, dayIndex, exercise.order);
  const plannedCount = exercise.singleResult ? 1 : exercise.plannedSets.length;
  const maxSetIndex = Math.max(
    plannedCount - 1,
    ...existing.map((s) => s.set_index),
    -1,
  );
  const indices = Array.from({ length: maxSetIndex + 1 }, (_, i) => i);

  function getRow(setIndex: number): SetLog {
    return (
      existing.find((s) => s.set_index === setIndex) ??
      emptySet(week, dayIndex, exercise, setIndex, setIndex >= plannedCount)
    );
  }

  function patch(setIndex: number, partial: Partial<SetLog>, triggerTimer = false) {
    const base = getRow(setIndex);
    const next = { ...base, ...partial };
    const family = maxFamily(exercise.name);
    const planned = exercise.plannedSets[setIndex] ?? "";
    const seed = parseMaxSeed(planned);
    let extra: { max_key?: string; max_value?: number; max_source?: string } = {};
    if (seed && family && next.done === 1) {
      const val = parseRepsNumber(next.reps) ?? parseRepsNumber(next.result_text);
      if (val != null) {
        extra = {
          max_key: maxKey(seed.letter, family),
          max_value: val,
          max_source: `w${week}-d${dayIndex}-ex${exercise.order}`,
        };
      }
    }
    onChangeSet({ ...next, ...extra });
    if (triggerTimer && next.done === 1) onSetDone();
  }

  function markAllDone() {
    for (const i of indices) {
      const row = getRow(i);
      if (row.done !== 1) patch(i, { done: 1 });
    }
  }

  return (
    <article className="ex-card">
      <div className="ex-head">
        <h3 className="ex-title">{exercise.name}</h3>
      </div>
      {historyLine && <p className="ex-meta">{historyLine}</p>}
      {exercise.videos.length > 0 && (
        <div className="video-links">
          {exercise.videos.map((v) => (
            <a key={v.url} href={v.url} target="_blank" rel="noreferrer" aria-label={`Film: ${v.label}`}>
              ▶ {v.label}
            </a>
          ))}
        </div>
      )}
      {exercise.hints.length > 0 && (
        <ul className="hints">
          {exercise.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {indices.map((setIndex) => {
        const row = getRow(setIndex);
        const planned = exercise.plannedSets[setIndex];
        const family = maxFamily(exercise.name);
        const resolved = planned
          ? resolveGoal(planned, family, maxes)
          : { display: "Dodatkowa seria", needsMax: false, primaryNumber: null, letter: null };
        const isExtra = setIndex >= plannedCount;

        return (
          <div key={setIndex} className={`set-row${row.done ? " done" : ""}`}>
            <button
              type="button"
              className="check"
              role="checkbox"
              aria-checked={row.done === 1}
              aria-label={`Seria ${setIndex + 1} zrobione`}
              onClick={() => patch(setIndex, { done: row.done === 1 ? 0 : 1 }, row.done !== 1)}
            >
              {row.done === 1 ? "✓" : ""}
            </button>
            <div>
              <div className="goal">
                Cel: {resolved.display}
                {resolved.needsMax && (
                  <div className="goal-hint">wpisz MAX, żeby policzyć</div>
                )}
              </div>
              {exercise.singleResult ? (
                <div className="fields single">
                  <MobileField
                    label="wynik"
                    value={row.result_text ?? ""}
                    inputMode="text"
                    onCommit={(v) => patch(setIndex, { result_text: v })}
                  />
                </div>
              ) : (
                <div className={`fields${exercise.hasWeight ? "" : " single"}`}>
                  <MobileField
                    label="powtórzenia"
                    value={row.reps ?? ""}
                    inputMode="numeric"
                    placeholder={
                      resolved.primaryNumber != null
                        ? String(resolved.primaryNumber)
                        : undefined
                    }
                    enterKeyHint={exercise.hasWeight ? "next" : "done"}
                    onCommit={(v) => patch(setIndex, { reps: v })}
                  />
                  {exercise.hasWeight && (
                    <MobileField
                      label="kg"
                      value={row.weight_kg == null ? "" : String(row.weight_kg)}
                      inputMode="decimal"
                      placeholder={
                        weightPlaceholder != null
                          ? String(weightPlaceholder)
                          : undefined
                      }
                      onCommit={(raw) => {
                        const v = raw.trim().replace(",", ".");
                        if (v === "" || v === ".") {
                          patch(setIndex, { weight_kg: null });
                          return;
                        }
                        const n = Number(v);
                        patch(setIndex, {
                          weight_kg: Number.isFinite(n) ? n : null,
                        });
                      }}
                    />
                  )}
                </div>
              )}
              {isExtra && (
                <div className="row-actions">
                  <button
                    type="button"
                    aria-label="Usuń dodatkową serię"
                    onClick={() => onDeleteSet(setIndex)}
                  >
                    ✕ usuń
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="ex-actions">
        {!exercise.singleResult && (
          <button
            type="button"
            onClick={() => {
              const nextIndex = maxSetIndex + 1;
              onChangeSet(
                emptySet(week, dayIndex, exercise, nextIndex, true),
              );
            }}
          >
            + seria
          </button>
        )}
        <button type="button" className="primary" onClick={markAllDone}>
          Wszystkie ✓
        </button>
      </div>
    </article>
  );
}
