import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import plan from "../data/plan-spkp.json";
import { AuthError, exportData, getProgress, logout, me } from "./api/client";
import { saveQueue } from "./api/saveQueue";
import { Login } from "./components/Login";
import { ExerciseCard } from "./components/ExerciseCard";
import { RestTimer, type RestTimerHandle } from "./components/RestTimer";
import { useWakeLock } from "./hooks/useWakeLock";
import { unlockAudio } from "./lib/feedback";
import {
  buildExerciseOrderIndex,
  dayDoneCount,
  lastWeightPlaceholder,
  previousHistoryLine,
} from "./lib/progress";
import { getDayFromPlan, resolveToday } from "./lib/planDate";
import type { MaxValues, Plan, SetLog, WeekNote } from "./types";

type Tab = "today" | "week" | "notes" | "settings";

const typedPlan = plan as Plan;

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [week, setWeek] = useState(1);
  const [dayIndex, setDayIndex] = useState(0);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [note, setNote] = useState("");
  const [maxes, setMaxes] = useState<MaxValues>({});
  const [allSetsCache, setAllSetsCache] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const restTimerRef = useRef<RestTimerHandle>(null);

  useEffect(() => {
    const unlock = () => void unlockAudio();
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  function startRestTimer() {
    restTimerRef.current?.startFromGesture(90);
  }

  const orderIndex = useMemo(
    () => buildExerciseOrderIndex(typedPlan.weeks),
    [],
  );

  useWakeLock(authed === true && tab === "today");

  useEffect(() => saveQueue.subscribe(setSaveStatus), []);

  useEffect(() => {
    me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  const today = useMemo(() => resolveToday(typedPlan), []);

  useEffect(() => {
    if (!authed) return;
    if (today.kind === "training") {
      setWeek(today.week);
      setDayIndex(today.dayIndex);
    } else if (today.kind === "weekend") {
      setWeek(today.nextWeek);
      setDayIndex(0);
    }
  }, [authed, today]);

  const loadWeek = useCallback(async (w: number) => {
    setLoading(true);
    try {
      const data = await getProgress(w);
      setSets(data.sets);
      setNote(data.note?.text ?? "");
      setMaxes(data.maxes);
      setAllSetsCache((prev) => {
        const others = prev.filter((s) => s.week !== w);
        return [...others, ...data.sets];
      });
    } catch (err) {
      if (err instanceof AuthError) setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    const w =
      tab === "today" && today.kind === "training" ? today.week : week;
    void loadWeek(w);
  }, [authed, week, tab, today, loadWeek]);

  const day = getDayFromPlan(typedPlan, week, dayIndex);
  const todayDay =
    today.kind === "training"
      ? getDayFromPlan(typedPlan, today.week, today.dayIndex)
      : null;
  const todayWeek = today.kind === "training" ? today.week : week;
  const todayDayIndex = today.kind === "training" ? today.dayIndex : dayIndex;

  function upsertLocal(set: SetLog) {
    setSets((prev) => {
      const rest = prev.filter(
        (s) =>
          !(
            s.day_index === set.day_index &&
            s.exercise_order === set.exercise_order &&
            s.set_index === set.set_index
          ),
      );
      return [...rest, set];
    });
    setAllSetsCache((prev) => {
      const rest = prev.filter(
        (s) =>
          !(
            s.week === set.week &&
            s.day_index === set.day_index &&
            s.exercise_order === set.exercise_order &&
            s.set_index === set.set_index
          ),
      );
      return [...rest, set];
    });
  }

  function onChangeSet(
    set: SetLog & { max_key?: string; max_value?: number; max_source?: string },
  ) {
    upsertLocal(set);
    if (set.max_key && set.max_value != null) {
      setMaxes((m) => ({ ...m, [set.max_key!]: set.max_value! }));
    }
    saveQueue.enqueue({ type: "set", payload: set });
  }

  function onDeleteSet(
    w: number,
    dIndex: number,
    exerciseOrder: number,
    setIndex: number,
  ) {
    setSets((prev) =>
      prev.filter(
        (s) =>
          !(
            s.day_index === dIndex &&
            s.exercise_order === exerciseOrder &&
            s.set_index === setIndex
          ),
      ),
    );
    saveQueue.enqueue({
      type: "delete",
      payload: {
        week: w,
        day_index: dIndex,
        exercise_order: exerciseOrder,
        set_index: setIndex,
      },
    });
  }

  function onNoteChange(text: string) {
    setNote(text);
    const payload: WeekNote = { week, text };
    saveQueue.enqueue({ type: "note", payload });
  }

  async function download(format: "json" | "csv") {
    const blob = await exportData(format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "json" ? "spkp-wyniki.json" : "spkp-wyniki.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authed === null) {
    return <div className="empty">Ładowanie…</div>;
  }
  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Zapisywanie…"
      : saveStatus === "error"
        ? "Nie zapisano, ponawiam"
        : saveStatus === "saved"
          ? "Zapisano"
          : "";

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1 className="brand">SPKP</h1>
        <div className={`save-status${saveStatus === "error" ? " error" : ""}`}>
          {saveLabel}
        </div>
      </header>

      {tab === "today" && (
        <section>
          {today.kind === "before" && (
            <div className="card">
              <h2>Plan jeszcze nie wystartował</h2>
              <p className="muted">Start: {today.startDate}</p>
            </div>
          )}
          {today.kind === "after" && (
            <div className="card">
              <h2>Plan zakończony</h2>
              <p className="muted">Ostatni dzień: {today.endDate}</p>
            </div>
          )}
          {today.kind === "weekend" && (
            <div className="card">
              <h2>Dziś wolne</h2>
              <p className="muted">Następny trening: poniedziałek {today.nextMonday}</p>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setWeek(today.nextWeek);
                  setDayIndex(0);
                  setTab("week");
                }}
              >
                Otwórz poniedziałek
              </button>
            </div>
          )}
          {today.kind === "training" && todayDay && (
            <>
              <div className="card">
                <h2>
                  Tydz. {todayWeek} · {todayDay.dayName}
                </h2>
                <p>{todayDay.title}</p>
                {todayDay.warmupVideo && (
                  <div className="video-links">
                    <a href={todayDay.warmupVideo} target="_blank" rel="noreferrer" aria-label="Film rozgrzewki">
                      ▶ Rozgrzewka
                    </a>
                  </div>
                )}
                {todayDay.notes.length > 0 && (
                  <ul className="notes">
                    {todayDay.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
              {loading ? (
                <p className="muted">Ładowanie wyników…</p>
              ) : (
                <div className="ex-list">
                  {todayDay.exercises.map((ex) => (
                    <ExerciseCard
                      key={ex.order}
                      week={todayWeek}
                      dayIndex={todayDayIndex}
                      exercise={ex}
                      logs={sets}
                      maxes={maxes}
                      historyLine={previousHistoryLine(
                        ex.name,
                        todayWeek,
                        todayDayIndex,
                        allSetsCache,
                        orderIndex,
                      )}
                      weightPlaceholder={lastWeightPlaceholder(
                        ex.name,
                        todayWeek,
                        todayDayIndex,
                        allSetsCache,
                        orderIndex,
                      )}
                      onChangeSet={onChangeSet}
                      onDeleteSet={(si) =>
                        onDeleteSet(todayWeek, todayDayIndex, ex.order, si)
                      }
                      onSetDone={startRestTimer}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {today.kind !== "training" && (
            <p className="muted" style={{ marginTop: "1rem" }}>
              Plan przeglądniesz w zakładce Tydzień.
            </p>
          )}
        </section>
      )}

      {tab === "week" && (
        <section>
          <div className="week-nav">
            <button
              type="button"
              aria-label="Poprzedni tydzień"
              disabled={week <= 1}
              onClick={() => setWeek((w) => Math.max(1, w - 1))}
            >
              ←
            </button>
            <h2>Tydzień {week}</h2>
            <button
              type="button"
              aria-label="Następny tydzień"
              disabled={week >= typedPlan.weeks.length}
              onClick={() => setWeek((w) => Math.min(typedPlan.weeks.length, w + 1))}
            >
              →
            </button>
          </div>
          <div className="day-grid">
            {[0, 1, 2, 3, 4].map((di) => {
              const d = getDayFromPlan(typedPlan, week, di);
              const prog = d ? dayDoneCount(sets, week, d) : { done: 0, total: 0 };
              const labels = ["Pn", "Wt", "Śr", "Cz", "Pt"];
              return (
                <button
                  key={di}
                  type="button"
                  className={`day-chip${dayIndex === di ? " active" : ""}`}
                  onClick={() => setDayIndex(di)}
                  aria-label={`${labels[di]}, postęp ${prog.done} z ${prog.total}`}
                >
                  <span>{labels[di]}</span>
                  <span className="prog">
                    {prog.done}/{prog.total}
                  </span>
                </button>
              );
            })}
          </div>
          {day && (
            <>
              <div className="card">
                <h2>{day.dayName}</h2>
                <p>{day.title}</p>
              </div>
              <div className="ex-list">
                {day.exercises.map((ex) => (
                  <ExerciseCard
                    key={ex.order}
                    week={week}
                    dayIndex={dayIndex}
                    exercise={ex}
                    logs={sets}
                    maxes={maxes}
                    historyLine={previousHistoryLine(
                      ex.name,
                      week,
                      dayIndex,
                      allSetsCache,
                      orderIndex,
                    )}
                    weightPlaceholder={lastWeightPlaceholder(
                      ex.name,
                      week,
                      dayIndex,
                      allSetsCache,
                      orderIndex,
                    )}
                    onChangeSet={onChangeSet}
                    onDeleteSet={(si) => onDeleteSet(week, dayIndex, ex.order, si)}
                    onSetDone={startRestTimer}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "notes" && (
        <section className="card">
          <h2>Notatki · tydzień {week}</h2>
          <textarea
            className="mobile-input"
            rows={8}
            aria-label="Notatki tygodnia"
            value={note}
            enterKeyHint="done"
            autoCapitalize="sentences"
            onChange={(e) => setNote(e.target.value)}
            onBlur={(e) => onNoteChange(e.target.value)}
            placeholder="Jak poszło w tym tygodniu…"
          />
        </section>
      )}

      {tab === "settings" && (
        <section className="card">
          <h2>Ustawienia</h2>
          <div className="ex-actions" style={{ flexDirection: "column" }}>
            <button type="button" onClick={() => void download("json")}>
              Pobierz kopię wyników (JSON)
            </button>
            <button type="button" onClick={() => void download("csv")}>
              Pobierz kopię (CSV)
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                setAuthed(false);
              }}
            >
              Wyloguj
            </button>
          </div>
          <p className="muted" style={{ marginTop: "1rem" }}>
            Motyw jasny/ciemny według ustawień telefonu.
          </p>
        </section>
      )}

      <RestTimer ref={restTimerRef} />

      <nav className="nav" aria-label="Nawigacja">
        {(
          [
            ["today", "Dziś"],
            ["week", "Tydzień"],
            ["notes", "Notatki"],
            ["settings", "Ustawienia"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
