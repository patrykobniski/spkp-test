import { describe, expect, it } from "vitest";
import { planEndDate, resolveToday } from "./planDate";
import type { Plan } from "../types";

const plan: Plan = {
  startDate: "2026-10-19",
  weeks: Array.from({ length: 12 }, (_, i) => ({
    week: i + 1,
    flags: [],
    days: [0, 1, 2, 3, 4].map((dayIndex) => ({
      dayIndex,
      dayName: "Dzień",
      title: `W${i + 1}D${dayIndex}`,
      notes: [],
      exercises: [],
    })),
  })),
};

describe("resolveToday", () => {
  it("before start", () => {
    const r = resolveToday(plan, new Date(2026, 9, 18, 12));
    expect(r.kind).toBe("before");
  });

  it("first Monday is week 1 day 0", () => {
    const r = resolveToday(plan, new Date(2026, 9, 19, 12));
    expect(r).toMatchObject({ kind: "training", week: 1, dayIndex: 0 });
  });

  it("Friday week 1", () => {
    const r = resolveToday(plan, new Date(2026, 9, 23, 12));
    expect(r).toMatchObject({ kind: "training", week: 1, dayIndex: 4 });
  });

  it("weekend points to next Monday", () => {
    const r = resolveToday(plan, new Date(2026, 9, 24, 12)); // Sat
    expect(r.kind).toBe("weekend");
    if (r.kind === "weekend") {
      expect(r.nextMonday).toBe("2026-10-26");
      expect(r.nextWeek).toBe(2);
    }
  });

  it("week 5 Monday (day 9 / MAX M pompki)", () => {
    // week 5 Mon = start + 28 days = 2026-11-16
    const r = resolveToday(plan, new Date(2026, 10, 16, 12));
    expect(r).toMatchObject({ kind: "training", week: 5, dayIndex: 0 });
  });

  it("after plan end", () => {
    const end = planEndDate(plan);
    expect(end).toBe("2027-01-10");
    const r = resolveToday(plan, new Date(2027, 0, 11, 12));
    expect(r.kind).toBe("after");
  });
});
