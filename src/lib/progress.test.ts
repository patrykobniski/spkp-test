import { describe, expect, it } from "vitest";
import { dayDoneCount, exerciseDoneCount } from "./progress";
import type { Exercise, PlanDay, SetLog } from "../types";

const exercise: Exercise = {
  order: 1,
  name: "Test",
  videos: [],
  hasWeight: false,
  singleResult: false,
  plannedSets: ["10", "10", "10"],
  hints: [],
};

const day: PlanDay = {
  dayIndex: 0,
  dayName: "Poniedziałek",
  title: "T",
  notes: [],
  exercises: [exercise],
};

describe("progress", () => {
  it("counts done sets vs planned", () => {
    const logs: SetLog[] = [
      {
        week: 1,
        day_index: 0,
        exercise_order: 1,
        set_index: 0,
        is_extra: 0,
        done: 1,
        reps: "10",
        weight_kg: null,
        result_text: null,
      },
      {
        week: 1,
        day_index: 0,
        exercise_order: 1,
        set_index: 1,
        is_extra: 0,
        done: 1,
        reps: "8",
        weight_kg: null,
        result_text: null,
      },
    ];
    expect(exerciseDoneCount(logs, 1, 0, exercise)).toEqual({ done: 2, total: 3 });
    expect(dayDoneCount(logs, 1, day)).toEqual({ done: 2, total: 3 });
  });
});
