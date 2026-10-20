import type { ProgressPayload, SetLog, WeekNote } from "../types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** `/api/...` lokalnie; `/spkp-test/api/...` na UX serverze. */
function apiUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${normalized}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", "dziennik-spkp");

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    throw new AuthError("unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function login(password: string): Promise<void> {
  await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await request("/api/logout", { method: "POST", body: "{}" });
}

export async function me(): Promise<{ ok: boolean }> {
  return request("/api/me");
}

export async function getProgress(week: number): Promise<ProgressPayload> {
  return request(`/api/progress?week=${week}`);
}

export async function putSet(set: SetLog): Promise<void> {
  await request("/api/set", { method: "PUT", body: JSON.stringify(set) });
}

export async function deleteSet(payload: {
  week: number;
  day_index: number;
  exercise_order: number;
  set_index: number;
}): Promise<void> {
  await request("/api/set", { method: "DELETE", body: JSON.stringify(payload) });
}

export async function putNote(note: WeekNote): Promise<void> {
  await request("/api/note", { method: "PUT", body: JSON.stringify(note) });
}

export async function exportData(format: "json" | "csv"): Promise<Blob> {
  const res = await fetch(apiUrl(`/api/export?format=${format}`), {
    credentials: "include",
    headers: { "X-Requested-With": "dziennik-spkp" },
  });
  if (res.status === 401) throw new AuthError("unauthorized");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
