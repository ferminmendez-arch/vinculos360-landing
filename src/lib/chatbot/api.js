/* =========================================================
   ENVÍO DEL CHATBOT → /api/leads (Azure Function)

   Resultados (los mismos que el formulario, ver src/lib/leads.js):
   - "confirmed"  → la API confirmó que quedó guardado.
   - "rejected"   → la API respondió con error: no se guardó.
   - "offline"    → sin conexión: no se envió.
   - "unverified" → se envió, pero no hubo respuesta a tiempo.

   Respaldo: si la API no existe (404/405, por ejemplo en desarrollo
   local) o no se pudo conectar, se envía directo al receptor de
   Apps Script con las mismas claves del formulario. Así nunca se
   pierde un lead por una falla de la API.
========================================================= */

import { interpretResponse, sendLead } from "../leads.js";
import { SERVICE_VALUES, savingsEstimate, sheetDevice } from "../../../api/src/lib/rules.js";

export const LEADS_API = "/api/leads";
export const EVENTS_API = "/api/chat-event";
const API_TIMEOUT_MS = 20000;

/* Mismas claves que el formulario: el receptor de Apps Script actual las entiende. */
export function toSheetPayload(payload) {
  return {
    name: payload.name,
    phone: payload.phone,
    zipCode: payload.zipCode,
    service: SERVICE_VALUES[payload.serviceKey],
    source: payload.source,
    medium: payload.medium,
    campaign: payload.campaign,
    ad: payload.ad,
    fbclid: payload.fbclid,
    device: sheetDevice(payload.device, savingsEstimate(payload).level),
    channel: "chatbot",
    language: payload.language,
    email: payload.email,
    preferredContact: payload.preferredContact,
    consent: payload.consent ? "sí" : "",
    consentVersion: payload.consentVersion,
  };
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function submitChatLead(payload, { endpoint = LEADS_API, timeoutMs = API_TIMEOUT_MS, fetchImpl, fallback = sendLead } = {}) {
  if (isOffline()) return { status: "offline", reason: "navigator_offline" };
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await doFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (isOffline()) return { status: "offline", reason: "network" };
    if (error && error.name === "AbortError") return { status: "unverified", reason: "timeout" };
    // No se pudo conectar con la API: respaldo directo a la hoja.
    return { ...(await fallback(toSheetPayload(payload))), via: "sheet_fallback" };
  }
  clearTimeout(timer);

  // La API no está desplegada en este entorno: respaldo directo.
  if (response.status === 404 || response.status === 405) {
    return { ...(await fallback(toSheetPayload(payload))), via: "sheet_fallback" };
  }

  const body = await response.text().catch(() => "");
  const result = interpretResponse(response.status, body);
  let data;
  try {
    data = JSON.parse(body) || {};
  } catch {
    data = {};
  }

  // La API funciona pero no pudo guardar (o está apagada sin destinos): un intento directo.
  if (result.status === "rejected" && (data.reason === "storage_unavailable" || data.reason === "no_storage_configured")) {
    return { ...(await fallback(toSheetPayload(payload))), via: "sheet_fallback" };
  }
  return { ...result, via: "api", id: data.id || "", prequalified: data.prequalified === true, reason: data.reason || result.reason };
}

/* ---------- Métricas anónimas ----------
   Solo nombre del evento, idioma y servicio. Nada de nombre,
   teléfono, ZIP ni correo. */

export function trackChatEvent(event, { language = "es", serviceKey = "" } = {}) {
  const data = { event, language, serviceKey };
  try {
    window.dataLayer?.push({ event, chat_language: language, chat_service: serviceKey });
  } catch {
    /* sin GTM */
  }
  try {
    const body = JSON.stringify(data);
    if (navigator.sendBeacon?.(EVENTS_API, new Blob([body], { type: "application/json" }))) return;
    globalThis
      .fetch?.(EVENTS_API, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
      .catch(() => {});
  } catch {
    /* las métricas nunca deben romper el chat */
  }
}
