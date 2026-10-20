import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "server", "data");
fs.mkdirSync(dataDir, { recursive: true });
const storePath = path.join(dataDir, "progress.json");

const PASSWORD = process.env.SPKP_PASSWORD || "spkp";
const sessions = new Map();
const SESSION_DAYS = 90;
const loginAttempts = new Map();

function loadStore() {
  if (!fs.existsSync(storePath)) {
    return { sets: [], notes: {}, maxes: {} };
  }
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function saveStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function getCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `spkp_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "spkp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  );
}

function requestToken(req) {
  const cookies = getCookies(req);
  if (cookies.spkp_session) return cookies.spkp_session;
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : "";
}

function requireAuth(req, res) {
  const token = requestToken(req);
  if (!token || !sessions.has(token)) {
    json(res, 401, { error: "unauthorized" });
    return false;
  }
  if (Date.now() > sessions.get(token)) {
    sessions.delete(token);
    json(res, 401, { error: "unauthorized" });
    return false;
  }
  const method = req.method || "GET";
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    if (req.headers["x-requested-with"] !== "dziennik-spkp") {
      json(res, 403, { error: "forbidden" });
      return false;
    }
  }
  return true;
}

function clientIp(req) {
  return req.socket.remoteAddress || "local";
}

function rateLimitLogin(ip) {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row || now - row.windowStart > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= 20) return false;
  row.count += 1;
  return true;
}

function setKey(s) {
  return `${s.week}:${s.day_index}:${s.exercise_order}:${s.set_index}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      });
      res.end();
      return;
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const ip = clientIp(req);
      if (!rateLimitLogin(ip)) {
        json(res, 429, { error: "too_many_attempts" });
        return;
      }
      const body = await readBody(req);
      if (!body?.password || String(body.password).trim() !== PASSWORD) {
        json(res, 401, { error: "invalid_password" });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      setSessionCookie(res, token);
      json(res, 200, { ok: true, token });
      return;
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      const cookies = getCookies(req);
      const auth = req.headers.authorization || "";
      const bearer = auth.match(/^Bearer\s+(\S+)/i)?.[1];
      const token = cookies.spkp_session || bearer;
      if (token) sessions.delete(token);
      clearSessionCookie(res);
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/me" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/progress" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const week = Number(url.searchParams.get("week") || "0");
      const store = loadStore();
      const sets = store.sets
        .filter((s) => s.week === week)
        .sort(
          (a, b) =>
            a.day_index - b.day_index ||
            a.exercise_order - b.exercise_order ||
            a.set_index - b.set_index,
        );
      const note = store.notes[String(week)]
        ? { week, text: store.notes[String(week)].text, updated_at: store.notes[String(week)].updated_at }
        : null;
      json(res, 200, { sets, note, maxes: store.maxes || {} });
      return;
    }

    if (pathname === "/api/set" && req.method === "PUT") {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const store = loadStore();
      const now = new Date().toISOString();
      const next = {
        week: body.week,
        day_index: body.day_index,
        exercise_order: body.exercise_order,
        set_index: body.set_index,
        is_extra: body.is_extra ? 1 : 0,
        done: body.done ? 1 : 0,
        reps: body.reps ?? null,
        weight_kg: body.weight_kg ?? null,
        result_text: body.result_text ?? null,
        updated_at: now,
      };
      const k = setKey(next);
      store.sets = store.sets.filter((s) => setKey(s) !== k);
      store.sets.push(next);
      if (body.max_key && body.max_value != null) {
        store.maxes = store.maxes || {};
        store.maxes[body.max_key] = Number(body.max_value);
      }
      saveStore(store);
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/set" && req.method === "DELETE") {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const store = loadStore();
      const k = setKey(body);
      store.sets = store.sets.filter((s) => setKey(s) !== k);
      saveStore(store);
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/note" && req.method === "PUT") {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const store = loadStore();
      store.notes[String(body.week)] = {
        text: body.text ?? "",
        updated_at: new Date().toISOString(),
      };
      saveStore(store);
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/export" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const format = url.searchParams.get("format") || "json";
      const store = loadStore();
      if (format === "csv") {
        const lines = [
          "week,day_index,exercise_order,set_index,is_extra,done,reps,weight_kg,result_text,updated_at",
        ];
        for (const s of store.sets) {
          lines.push(
            [
              s.week,
              s.day_index,
              s.exercise_order,
              s.set_index,
              s.is_extra,
              s.done,
              JSON.stringify(s.reps ?? ""),
              s.weight_kg ?? "",
              JSON.stringify(s.result_text ?? ""),
              s.updated_at,
            ].join(","),
          );
        }
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="spkp-export.csv"',
        });
        res.end(lines.join("\n"));
        return;
      }
      json(res, 200, {
        sets: store.sets,
        notes: Object.entries(store.notes).map(([week, n]) => ({
          week: Number(week),
          ...n,
        })),
        maxes: store.maxes,
      });
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "server_error" });
  }
});

const PORT = 8787;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`SPKP API http://127.0.0.1:${PORT} (hasło lokalne: ${PASSWORD})`);
});
