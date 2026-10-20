import { AuthError, deleteSet, putNote, putSet } from "./client";
import type { SetLog, WeekNote } from "../types";

type Job =
  | { type: "set"; payload: SetLog }
  | { type: "delete"; payload: Parameters<typeof deleteSet>[0] }
  | { type: "note"; payload: WeekNote };

type Listener = (status: "idle" | "saving" | "saved" | "error") => void;

export class SaveQueue {
  private queue: Job[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private listeners = new Set<Listener>();
  private debounceMs: number;

  constructor(debounceMs = 600) {
    this.debounceMs = debounceMs;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(status: "idle" | "saving" | "saved" | "error") {
    for (const fn of this.listeners) fn(status);
  }

  enqueue(job: Job) {
    // coalesce set/delete for same key
    if (job.type === "set" || job.type === "delete") {
      const key = `${job.payload.week}:${job.payload.day_index}:${job.payload.exercise_order}:${job.payload.set_index}`;
      this.queue = this.queue.filter((j) => {
        if (j.type !== "set" && j.type !== "delete") return true;
        const k = `${j.payload.week}:${j.payload.day_index}:${j.payload.exercise_order}:${j.payload.set_index}`;
        return k !== key;
      });
    }
    if (job.type === "note") {
      this.queue = this.queue.filter((j) => j.type !== "note" || j.payload.week !== job.payload.week);
    }
    this.queue.push(job);
    this.emit("saving");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  async flush() {
    if (this.running) return;
    this.running = true;
    this.emit("saving");
    while (this.queue.length > 0) {
      const batch = [...this.queue];
      this.queue = [];
      try {
        for (const job of batch) {
          if (job.type === "set") await putSet(job.payload);
          else if (job.type === "delete") await deleteSet(job.payload);
          else await putNote(job.payload);
        }
        this.emit("saved");
      } catch (err) {
        // re-queue and retry
        this.queue = [...batch, ...this.queue];
        this.emit("error");
        if (err instanceof AuthError) {
          this.running = false;
          throw err;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.running = false;
  }
}

export const saveQueue = new SaveQueue(600);
