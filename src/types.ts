export type VideoLink = { label: string; url: string };

export type Exercise = {
  order: number;
  name: string;
  videos: VideoLink[];
  hasWeight: boolean;
  singleResult: boolean;
  plannedSets: string[];
  hints: string[];
};

export type PlanDay = {
  dayIndex: number;
  dayName: string;
  title: string;
  notes: string[];
  warmupVideo?: string;
  exercises: Exercise[];
};

export type PlanWeek = {
  week: number;
  flags: string[];
  days: PlanDay[];
};

export type Plan = {
  startDate: string;
  weeks: PlanWeek[];
};

export type SetLog = {
  week: number;
  day_index: number;
  exercise_order: number;
  set_index: number;
  is_extra: 0 | 1;
  done: 0 | 1;
  reps: string | null;
  weight_kg: number | null;
  result_text: string | null;
  updated_at?: string;
};

export type WeekNote = {
  week: number;
  text: string;
  updated_at?: string;
};

export type MaxValues = Record<string, number>;

export type ProgressPayload = {
  sets: SetLog[];
  note: WeekNote | null;
  maxes: MaxValues;
};

export type TodayInfo =
  | {
      kind: "training";
      week: number;
      dayIndex: number;
      day: PlanDay;
      date: string;
    }
  | {
      kind: "weekend";
      nextMonday: string;
      nextWeek: number;
      nextDayIndex: 0;
    }
  | {
      kind: "before";
      startDate: string;
    }
  | {
      kind: "after";
      endDate: string;
    };
