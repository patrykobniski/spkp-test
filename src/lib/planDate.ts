import type { Plan, PlanDay, TodayInfo } from "../types";

const MS_DAY = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD as local calendar date (noon to avoid DST edges). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function planEndDate(plan: Plan): string {
  const start = parseLocalDate(plan.startDate);
  // 12 weeks × 7 days − 1 = last Sunday of week 12
  return formatLocalDate(addDays(start, plan.weeks.length * 7 - 1));
}

export function getDayFromPlan(
  plan: Plan,
  week: number,
  dayIndex: number,
): PlanDay | null {
  const w = plan.weeks.find((x) => x.week === week);
  if (!w) return null;
  return w.days.find((d) => d.dayIndex === dayIndex) ?? null;
}

/**
 * Map a calendar date to plan position.
 * startDate is Monday of week 1.
 * dayIndex 0–4 = Mon–Fri; Sat/Sun = weekend.
 */
export function resolveToday(plan: Plan, now: Date = new Date()): TodayInfo {
  const start = parseLocalDate(plan.startDate);
  const today = parseLocalDate(formatLocalDate(now));
  const end = parseLocalDate(planEndDate(plan));

  if (today < start) {
    return { kind: "before", startDate: plan.startDate };
  }
  if (today > end) {
    return { kind: "after", endDate: formatLocalDate(end) };
  }

  const diffDays = Math.floor((today.getTime() - start.getTime()) / MS_DAY);
  const week = Math.floor(diffDays / 7) + 1;
  const weekday = diffDays % 7; // 0=Mon … 6=Sun

  if (weekday >= 5) {
    const daysToMonday = 7 - weekday;
    const nextMonday = addDays(today, daysToMonday);
    const nextDiff = Math.floor(
      (nextMonday.getTime() - start.getTime()) / MS_DAY,
    );
    const nextWeek = Math.floor(nextDiff / 7) + 1;
    return {
      kind: "weekend",
      nextMonday: formatLocalDate(nextMonday),
      nextWeek: Math.min(nextWeek, plan.weeks.length),
      nextDayIndex: 0,
    };
  }

  const day = getDayFromPlan(plan, week, weekday);
  if (!day) {
    return { kind: "weekend", nextMonday: formatLocalDate(today), nextWeek: week, nextDayIndex: 0 };
  }

  return {
    kind: "training",
    week,
    dayIndex: weekday,
    day,
    date: formatLocalDate(today),
  };
}

export function dayProgress(
  plannedSetCount: number,
  doneCount: number,
): { done: number; total: number } {
  return { done: doneCount, total: Math.max(plannedSetCount, doneCount) };
}
