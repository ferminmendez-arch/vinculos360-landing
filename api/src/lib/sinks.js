/* =========================================================
   DESTINOS DE LOS LEADS
   1) Hoja de Google "Vínculos 360 — Leads" (receptor de Apps Script).
      Es el destino actual: de ahí el agente de leads avisa por correo
      al dueño y prepara el borrador de WhatsApp.
   2) Azure Table Storage (opcional). Se activa solo si existe la
      configuración LEADS_TABLE_SAS_URL: una URL SAS de UNA tabla con
      permiso de solo AGREGAR ("sp=a"). La función no puede leer,
      cambiar ni borrar registros (mínimo privilegio).
========================================================= */

import { answersSummary, sheetDevice } from "./rules.js";

export const DEFAULT_SHEET_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwEVckFhVLHNjrMFNDbYe0N88ikApHK64Z2oB2RJH18nDqA7r02xrwSxYE8L5dzhLNm/exec";

export function readConfig(env = process.env) {
  const flag = (name, fallback) => {
    const v = String(env[name] ?? "").trim().toLowerCase();
    if (!v) return fallback;
    return v === "true" || v === "1" || v === "yes";
  };
  return {
    sheetEnabled: flag("LEADS_SHEET_ENABLED", true),
    sheetEndpoint: String(env.LEADS_SHEET_ENDPOINT || DEFAULT_SHEET_ENDPOINT).trim(),
    // El receptor v2 (instalado el 26 nov 2026) suma las métricas en la pestaña "Chatbot".
    eventsToSheet: flag("CHAT_EVENTS_TO_SHEET", true),
    leadsTableSasUrl: String(env.LEADS_TABLE_SAS_URL || "").trim(),
    eventsTableSasUrl: String(env.EVENTS_TABLE_SAS_URL || "").trim(),
    extraOrigins: String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

/* Respuesta del receptor de Apps Script: {"ok":true,"result":"success","id":"…"} */
export function interpretSheetResponse(status, text) {
  if (status < 200 || status >= 300) return { ok: false, reason: `http_${status}` };
  try {
    const json = JSON.parse(text);
    if (json && json.ok !== false && !/error|fail/i.test(String(json.result ?? ""))) {
      return { ok: true, id: json.id || "" };
    }
    return { ok: false, reason: String(json?.reason || "script_error") };
  } catch {
    return { ok: false, reason: "unreadable_response" };
  }
}

export async function postToSheet(endpoint, body, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow", // Apps Script responde con 302 a script.googleusercontent.com
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => "");
    return interpretSheetResponse(res.status, text);
  } catch (error) {
    return { ok: false, reason: error?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

/* Inserta una entidad con la API REST de Table Storage (sin SDK). */
export async function insertTableEntity(sasUrl, entity, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  try {
    const res = await fetchImpl(sasUrl, {
      method: "POST",
      headers: {
        Accept: "application/json;odata=nometadata",
        "Content-Type": "application/json",
        "x-ms-version": "2019-02-02",
        Prefer: "return-no-content",
      },
      body: JSON.stringify(entity),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 204 || res.status === 201) return { ok: true };
    return { ok: false, reason: `http_${res.status}` };
  } catch (error) {
    return { ok: false, reason: error?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

/* Evita que un valor se ejecute como fórmula si alguien exporta la tabla. */
function cell(value) {
  const s = String(value ?? "");
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

export function leadToTableEntity(lead, { id, receivedAt, prequalified, reasons, savings = { level: "sin_datos" } }) {
  return {
    PartitionKey: receivedAt.slice(0, 7), // AAAA-MM
    RowKey: id,
    ReceivedAt: receivedAt,
    Service: lead.service,
    Answers: JSON.stringify(lead.answers),
    Name: cell(lead.name),
    Phone: lead.phone,
    ZipCode: lead.zipCode,
    Email: cell(lead.email),
    PreferredContact: lead.preferredContact,
    Consent: true,
    ConsentVersion: lead.consentVersion,
    ConsentAt: receivedAt,
    Language: lead.language,
    Prequalified: prequalified,
    Reasons: reasons.join(","),
    SavingsLevel: savings.level,
    ...(savings.rateCents != null ? { RateCents: savings.rateCents } : {}),
    Source: cell(lead.source),
    Medium: cell(lead.medium),
    Campaign: cell(lead.campaign),
    Ad: cell(lead.ad),
    Fbclid: cell(lead.fbclid),
    Device: lead.device,
    Channel: "chatbot",
  };
}

/* Cuerpo para el receptor de Apps Script. Las 10 claves originales
   (name … device) son las que entiende el receptor actual; el resto
   solo se guarda cuando se instala el receptor v2. */
export function leadToSheetBody(lead, { id, receivedAt, prequalified, savings = { level: "sin_datos" } }) {
  return {
    name: lead.name,
    phone: lead.phone,
    zipCode: lead.zipCode,
    service: lead.service,
    source: lead.source,
    medium: lead.medium,
    campaign: lead.campaign,
    ad: lead.ad,
    fbclid: lead.fbclid,
    // "Mobile · Chatbot": el canal queda visible en la hoja desde hoy, sin cambiar el receptor.
    device: sheetDevice(lead.device, savings.level),
    channel: "chatbot",
    language: lead.language,
    email: lead.email,
    preferredContact: lead.preferredContact,
    consent: "sí",
    consentVersion: lead.consentVersion,
    consentAt: receivedAt,
    qualification: prequalified ? "Precalificado" : "Revisar",
    answers: answersSummary(lead.serviceKey, lead.answers),
    chatLeadId: id,
  };
}
