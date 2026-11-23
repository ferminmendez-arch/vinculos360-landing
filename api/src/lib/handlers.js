/* =========================================================
   LÓGICA DE LOS ENDPOINTS (sin dependencias de Azure, se prueba
   con node --test). api/src/functions/api.js solo la conecta al
   runtime de Azure Functions.

   POST /api/leads       → valida, filtra spam, guarda y confirma.
   POST /api/chat-event  → métricas anónimas del chatbot.
   GET  /api/health      → estado de la configuración (sin secretos).
========================================================= */

import { randomUUID } from "node:crypto";
import { validateChatLead, validateEvent } from "./rules.js";
import { insertTableEntity, leadToSheetBody, leadToTableEntity, postToSheet, readConfig } from "./sinks.js";

export const MAX_BODY_BYTES = 8 * 1024;
/* Menos de esto entre abrir el chat y enviar = casi seguro un bot. */
export const MIN_ELAPSED_MS = 4000;

const BASE_ORIGINS = ["https://www.vinculos360.com", "https://vinculos360.com"];
/* Entornos de Azure Static Web Apps de este sitio (producción y vistas previas de PR). */
const SWA_HOST_PATTERN = /^https:\/\/red-stone-0a156a910(-[a-z0-9]+)?\.(centralus\.)?(\d+\.)?azurestaticapps\.net$/i;
const LOCAL_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isAllowedOrigin(origin, extra = []) {
  if (!origin) return true; // algunos clientes no envían Origin en peticiones del mismo sitio
  const o = String(origin).toLowerCase();
  return BASE_ORIGINS.includes(o) || extra.includes(o) || SWA_HOST_PATTERN.test(o) || LOCAL_PATTERN.test(o);
}

/* ---------- Límite de frecuencia por IP (por instancia, en memoria) ---------- */

export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    if (!key) return true;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
    return true;
  };
}

const leadLimiter = createRateLimiter({ limit: 6, windowMs: 10 * 60 * 1000 });
const eventLimiter = createRateLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });

export function clientIp(headers) {
  const raw = headers.get("x-azure-clientip") || headers.get("x-forwarded-for") || headers.get("x-client-ip") || "";
  const first = raw.split(",")[0].trim();
  // "1.2.3.4:5678" → "1.2.3.4" (IPv6 entre corchetes se conserva)
  return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(first) ? first.replace(/:\d+$/, "") : first;
}

const json = (status, body, extraHeaders = {}) => ({
  status,
  jsonBody: body,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders },
});

async function readJsonBody(request) {
  const text = await request.text();
  if (!text || Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return { error: "invalid_body" };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: "invalid_json" };
  }
}

/* ---------- POST /api/leads ---------- */

export async function handleLead(request, { env = process.env, fetchImpl = fetch, log = console, now = () => new Date(), limiter = leadLimiter } = {}) {
  const config = readConfig(env);
  if (!isAllowedOrigin(request.headers.get("origin"), config.extraOrigins)) {
    return json(403, { ok: false, result: "error", reason: "forbidden_origin" });
  }
  if (!limiter(clientIp(request.headers))) {
    return json(429, { ok: false, result: "error", reason: "rate_limited" }, { "Retry-After": "600" });
  }

  const body = await readJsonBody(request);
  if (body.error) return json(400, { ok: false, result: "error", reason: body.error });
  const data = body.data;

  // Trampas anti-spam: se responde "éxito" para no dar pistas al bot, pero no se guarda nada.
  const elapsed = Number(data?.elapsedMs);
  if (data && (String(data.company || "").trim() || !Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS)) {
    log.warn?.("lead descartado por filtro anti-spam");
    return json(200, { ok: true, result: "success", id: null });
  }

  const checked = validateChatLead(data);
  if (checked.error) return json(400, { ok: false, result: "error", reason: checked.error });

  const { lead, prequalified, reasons } = checked;
  const id = randomUUID();
  const receivedAt = now().toISOString();
  const meta = { id, receivedAt, prequalified, reasons };

  const tasks = [];
  if (config.leadsTableSasUrl) {
    tasks.push(insertTableEntity(config.leadsTableSasUrl, leadToTableEntity(lead, meta), { fetchImpl }).then((r) => ({ sink: "table", ...r })));
  }
  if (config.sheetEnabled && config.sheetEndpoint) {
    tasks.push(postToSheet(config.sheetEndpoint, leadToSheetBody(lead, meta), { fetchImpl }).then((r) => ({ sink: "sheet", ...r })));
  }
  if (!tasks.length) {
    log.error?.("No hay ningún destino configurado para los leads.");
    return json(503, { ok: false, result: "error", reason: "no_storage_configured" });
  }

  const results = await Promise.all(tasks);
  const saved = results.filter((r) => r.ok).map((r) => r.sink);
  const failed = results.filter((r) => !r.ok);
  // Sin datos personales en los registros: solo id, destino y motivo.
  failed.forEach((r) => log.error?.(`lead ${id}: falló el destino ${r.sink} (${r.reason})`));

  if (!saved.length) {
    return json(502, { ok: false, result: "error", reason: "storage_unavailable" });
  }
  log.info?.(`lead ${id} guardado en ${saved.join("+")} (precalificado: ${prequalified})`);
  return json(200, { ok: true, result: "success", id, prequalified, saved });
}

/* ---------- POST /api/chat-event ---------- */

export async function handleEvent(request, { env = process.env, fetchImpl = fetch, log = console, now = () => new Date(), limiter = eventLimiter } = {}) {
  const config = readConfig(env);
  if (!isAllowedOrigin(request.headers.get("origin"), config.extraOrigins)) return json(403, { ok: false });
  if (!limiter(clientIp(request.headers))) return json(429, { ok: false });

  const body = await readJsonBody(request);
  if (body.error) return json(400, { ok: false, reason: body.error });
  const checked = validateEvent(body.data);
  if (checked.error) return json(400, { ok: false, reason: checked.error });

  const { event, language, serviceKey } = checked.event;
  const at = now().toISOString();
  const tasks = [];
  if (config.eventsTableSasUrl) {
    tasks.push(
      insertTableEntity(
        config.eventsTableSasUrl,
        { PartitionKey: at.slice(0, 10), RowKey: `${Date.parse(at)}-${randomUUID().slice(0, 8)}`, Event: event, Language: language, Service: serviceKey },
        { fetchImpl }
      )
    );
  }
  if (config.eventsToSheet && config.sheetEnabled && config.sheetEndpoint) {
    tasks.push(postToSheet(config.sheetEndpoint, { type: "chat_event", event, language, serviceKey }, { fetchImpl, timeoutMs: 8000 }));
  }
  const results = await Promise.all(tasks);
  const stored = results.some((r) => r.ok);
  // Siempre queda en los registros de la función (sin datos personales).
  log.info?.(`metrica ${event} ${language} ${serviceKey || "-"} guardada=${stored}`);
  return json(202, { ok: true, stored });
}

/* ---------- GET /api/health ---------- */

export function handleHealth({ env = process.env } = {}) {
  const c = readConfig(env);
  return json(200, {
    ok: true,
    service: "vinculos360-chatbot-api",
    sinks: {
      sheet: c.sheetEnabled && Boolean(c.sheetEndpoint),
      leadsTable: Boolean(c.leadsTableSasUrl),
      eventsTable: Boolean(c.eventsTableSasUrl),
      eventsToSheet: c.eventsToSheet,
    },
  });
}
