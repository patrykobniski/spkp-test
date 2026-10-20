import type { ProgressPayload, SetLog, WeekNote } from "../types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const TOKEN_KEY = "spkp_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

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
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

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
  const data = await request<{ ok: boolean; token?: string }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ password: password.trim() }),
  });
  if (data.token) setStoredToken(data.token);
}

export async function logout(): Promise<void> {
  try {
    await request("/api/logout", { method: "POST", body: "{}" });
  } finally {
    setStoredToken(null);
  }
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
  const headers = new Headers({ "X-Requested-With": "dziennik-spkp" });
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(`/api/export?format=${format}`), {
    credentials: "include",
    headers,
  });
  if (res.status === 401) throw new AuthError("unauthorized");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
