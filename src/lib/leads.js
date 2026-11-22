/* =========================================================
   ENVÍO DE LEADS → Google Apps Script → Google Sheets ("Leads")

   Antes se usaba fetch(..., { mode: "no-cors" }). Con no-cors la
   respuesta es opaca: la promesa se resuelve aunque el script falle,
   así que el sitio abría WhatsApp suponiendo que el lead se guardó.

   Ahora se envía una "petición simple" CORS (POST + text/plain, sin
   cabeceras personalizadas). Apps Script responde con
   Access-Control-Allow-Origin: *, por lo que la respuesta se puede leer
   y verificar. El cuerpo y los campos enviados son los mismos que antes,
   así que el script en producción no necesita cambios.

   Resultados posibles:
   - "confirmed"  → el script respondió sin error.
   - "rejected"   → el script respondió con un error (no se guardó).
   - "offline"    → el navegador no tiene conexión (no se envió).
   - "unverified" → se envió, pero la respuesta no se pudo leer o tardó
                    demasiado: puede o no haberse guardado.
========================================================= */

import { DUPLICATE_WINDOW_MS, LEAD_TIMEOUT_MS, LEADS_ENDPOINT } from "../config.js";

const QUEUE_KEY = "v360_pending_leads";
const LAST_KEY = "v360_last_lead";
const QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const QUEUE_MAX_ATTEMPTS = 5;

/* ---------- Interpretación de la respuesta ---------- */

const NO_RETURN_PATTERN = /did not return anything|no devolvi[oó] nada/i;
const ERROR_PATTERN =
  /\b(error|exception|excepci[oó]n|typeerror|referenceerror|syntaxerror|failed|fall[oó])\b/i;

export function interpretResponse(httpStatus, bodyText) {
  if (httpStatus < 200 || httpStatus >= 300) {
    return { status: "rejected", reason: `http_${httpStatus}` };
  }

  const text = String(bodyText || "").trim();
  if (!text) return { status: "confirmed", reason: "empty_ok" };

  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      const flag = String(json.result ?? json.status ?? "").toLowerCase();
      if (json.ok === false || json.success === false || /error|fail/.test(flag)) {
        return { status: "rejected", reason: "script_error" };
      }
      return { status: "confirmed", reason: "json_ok" };
    }
  } catch {
    /* no es JSON */
  }

  // El script se ejecutó sin errores pero no devolvió contenido.
  if (NO_RETURN_PATTERN.test(text)) return { status: "confirmed", reason: "no_return" };
  if (ERROR_PATTERN.test(text)) return { status: "rejected", reason: "script_error" };
  return { status: "confirmed", reason: "text_ok" };
}

/* ---------- Envío ---------- */

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function sendLead(payload, { endpoint = LEADS_ENDPOINT, timeoutMs = LEAD_TIMEOUT_MS, fetchImpl } = {}) {
  if (isOffline()) return { status: "offline", reason: "navigator_offline" };

  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    return interpretResponse(response.status, body);
  } catch (error) {
    if (isOffline()) return { status: "offline", reason: "network" };
    if (error && error.name === "AbortError") return { status: "unverified", reason: "timeout" };
    // TypeError: la petición pudo llegar pero la respuesta no se pudo leer.
    return { status: "unverified", reason: "unreadable_response" };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Prevención de duplicados ---------- */

function fingerprint(payload) {
  return `${String(payload.phone).replace(/\D/g, "")}|${payload.service}`;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
}

/* ¿Ya se confirmó esta misma solicitud (teléfono + servicio) hace poco? */
export function wasRecentlyConfirmed(payload, now = Date.now()) {
  const last = readJson(LAST_KEY, null);
  return Boolean(last && last.fp === fingerprint(payload) && now - last.at < DUPLICATE_WINDOW_MS);
}

export function rememberConfirmed(payload, now = Date.now()) {
  // Solo se guarda una huella (teléfono + servicio), no el nombre ni el ZIP.
  writeJson(LAST_KEY, { fp: fingerprint(payload), at: now });
}

/* ---------- Cola local para reintentos ----------
   Solo se encolan leads que con certeza NO se guardaron
   ("rejected" u "offline"), para no crear duplicados.
   Se eliminan al confirmarse o a los 7 días. */

export function enqueueLead(payload, now = Date.now()) {
  const queue = readJson(QUEUE_KEY, []).filter((item) => item.fp !== fingerprint(payload));
  queue.push({ fp: fingerprint(payload), payload, createdAt: now, attempts: 0 });
  writeJson(QUEUE_KEY, queue);
}

export function removeFromQueue(payload) {
  const queue = readJson(QUEUE_KEY, []).filter((item) => item.fp !== fingerprint(payload));
  writeJson(QUEUE_KEY, queue.length ? queue : null);
}

let flushing = false;

export async function flushQueue(options = {}) {
  if (flushing || isOffline()) return;
  flushing = true;
  try {
    const now = Date.now();
    const queue = readJson(QUEUE_KEY, []).filter(
      (item) => now - item.createdAt < QUEUE_MAX_AGE_MS && item.attempts < QUEUE_MAX_ATTEMPTS
    );
    const remaining = [];
    for (const item of queue) {
      const result = await sendLead(item.payload, options);
      if (result.status === "confirmed") {
        rememberConfirmed(item.payload);
      } else if (result.status === "rejected" || result.status === "offline") {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
      // "unverified": la petición se envió; no se reintenta para evitar duplicados.
    }
    writeJson(QUEUE_KEY, remaining.length ? remaining : null);
  } finally {
    flushing = false;
  }
}
