/* =========================================================
   Utilidades compartidas de los agentes (sin dependencias).
========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AUTOMATION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_DIR = path.resolve(AUTOMATION_DIR, "..");

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadBusiness() {
  return readJson(path.join(AUTOMATION_DIR, "config", "business.json"));
}

/* ---------- Registro estructurado (sin datos personales) ---------- */

export function createLogger(agent, { sink = console } = {}) {
  const entries = [];
  const write = (level, message, extra = {}) => {
    const entry = { at: new Date().toISOString(), agent, level, message, ...extra };
    entries.push(entry);
    const line = JSON.stringify(entry);
    if (level === "error") sink.error(line);
    else sink.log(line);
  };
  return {
    entries,
    info: (m, e) => write("info", m, e),
    warn: (m, e) => write("warn", m, e),
    error: (m, e) => write("error", m, e),
  };
}

/* ---------- Reintentos con espera exponencial ----------
   Solo se reintenta cuando `isRetryable(error)` es verdadero.
   Así se evita repetir una acción que pudo haberse completado. */

export async function withRetry(fn, { attempts = 3, baseDelayMs = 1000, isRetryable = () => true, sleep, onRetry } = {}) {
  const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryable(error)) throw error;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      if (onRetry) onRetry(error, attempt, delay);
      await wait(delay);
    }
  }
  throw lastError;
}

/* ---------- Front matter (subconjunto simple de YAML) ---------- */

export function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
      if (value === "true") value = true;
      else if (value === "false") value = false;
    }
    data[m[1]] = value;
  }
  return { data, body: match[2] };
}

export function stringifyFrontMatter(data) {
  const lines = Object.entries(data).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: [${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    if (typeof value === "boolean") return `${key}: ${value}`;
    return `${key}: ${JSON.stringify(String(value))}`;
  });
  return `---\n${lines.join("\n")}\n---\n`;
}

/* Devuelve el texto de una sección "## Título" del cuerpo. */
export function extractSection(body, heading) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return "";
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

/* ---------- Fechas en la zona horaria de Texas ---------- */

/* Diferencia (minutos) entre la hora local de `timeZone` y UTC en un instante. */
function tzOffsetMinutes(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/* Convierte fecha y hora locales ("2026-11-30", "19:00") de `timeZone` a Date (UTC). */
export function zonedToUtc(dateStr, timeStr, timeZone) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const offset = tzOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Segunda pasada por si el cambio de horario cae entre medio.
  const offset2 = tzOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

export function localDateString(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/* Lunes (AAAA-MM-DD) de la semana siguiente a `now`, en la zona dada. */
export function nextMonday(now, timeZone) {
  const today = localDateString(now, timeZone);
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const isoDow = ((base.getUTCDay() + 6) % 7) + 1; // 1 = lunes
  base.setUTCDate(base.getUTCDate() + (8 - isoDow));
  return base.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/* Semana ISO "2026-W49" de una fecha AAAA-MM-DD. */
export function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const WEEKDAYS_ES = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
