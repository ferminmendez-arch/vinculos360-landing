/* =========================================================
   MEDICIÓN DE CONVERSIONES (Google Analytics 4 + métricas propias)

   Regla de privacidad: a Google solo se envía el NOMBRE del evento y
   parámetros de una lista cerrada (idioma, servicio, sección). Nunca
   nombre, teléfono, correo, ZIP, montos de factura ni texto libre.

   Eventos de embudo (nombres estándar del proyecto):
     analyzer_started      primer dato escrito en el Analizador de factura
     analyzer_completed    el Analizador mostró un resultado
     comparison_requested  clic en "comparación personalizada"
     lead_submitted        SOLO cuando el receptor confirmó que el lead se guardó
     whatsapp_clicked      clic o redirección a WhatsApp con Vínculos 360
     customer_enrolled     no ocurre en el sitio: sale de la hoja (Estado
                           "Inscrito"/"Cliente") en el reporte semanal.

   GA4 se carga después de que la página terminó de cargar, para no
   afectar la velocidad. Sin ID configurado, no se carga nada de Google.
========================================================= */

import { GA_MEASUREMENT_ID } from "../config.js";

export const FUNNEL_EVENTS = [
  "analyzer_started",
  "analyzer_completed",
  "comparison_requested",
  "lead_submitted",
  "whatsapp_clicked",
];

/* Eventos que ya existían en las métricas propias, con su nombre GA4 estándar. */
const GA_NAME = {
  analyzer_calc: "analyzer_completed",
  analyzer_cta: "comparison_requested",
};

const ALLOWED_PARAMS = {
  language: ["es", "en"],
  service: ["electricidad", "internet", "seguridad", "television", "celular", "identidad", "pagos", "otros", ""],
  entry_point: ["formulario", "chat", "analizador", "recordatorio", "guia", "boton", ""],
};

/* Deja solo parámetros permitidos con valores de la lista. */
export function sanitizeParams(params = {}) {
  const clean = {};
  for (const [key, allowed] of Object.entries(ALLOWED_PARAMS)) {
    const value = params[key];
    if (typeof value === "string" && allowed.includes(value) && value) clean[key] = value;
  }
  return clean;
}

export function gaEventName(name) {
  return GA_NAME[name] || name;
}

let gaRequested = false;

function gtag() {
  // gtag.js requiere el objeto "arguments", no un arreglo.
  window.dataLayer.push(arguments);
}

/* Inicia GA4 (una vez). Llamar al cargar la página. */
export function initAnalytics({ measurementId = GA_MEASUREMENT_ID } = {}) {
  if (gaRequested || typeof window === "undefined" || !/^G-[A-Z0-9]{4,}$/.test(measurementId || "")) return false;
  gaRequested = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const load = () => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  };
  if (document.readyState === "complete") window.setTimeout(load, 0);
  else window.addEventListener("load", () => window.setTimeout(load, 0), { once: true });
  watchWhatsAppClicks();
  return true;
}

/* Envía un evento a GA4 (si está activo) y al dataLayer. Nunca lanza errores. */
export function sendToGoogle(name, params = {}) {
  try {
    const clean = sanitizeParams(params);
    const gaName = gaEventName(name);
    if (typeof window.gtag === "function") window.gtag("event", gaName, clean);
    else window.dataLayer?.push({ event: gaName, ...clean });
  } catch {
    /* la medición nunca debe romper el sitio */
  }
}

/* ---------- Métricas propias (/api/chat-event → tabla de Azure / hoja Métricas) ---------- */

export const EVENTS_API = "/api/chat-event";

/* Nombres que acepta /api/chat-event (api/src/lib/rules.js → EVENT_NAMES). */
const FIRST_PARTY = new Set([
  "chat_open",
  "chat_start",
  "chat_complete",
  "chat_qualified",
  "analyzer_view",
  "analyzer_calc",
  "analyzer_cta",
  "analyzer_share",
  "reminder_signup",
  "analyzer_started",
  "lead_submitted",
  "whatsapp_clicked",
]);

function sendFirstParty(event, { language = "es", service = "" } = {}) {
  if (!FIRST_PARTY.has(event)) return;
  try {
    const body = JSON.stringify({ event, language, serviceKey: service });
    if (navigator.sendBeacon?.(EVENTS_API, new Blob([body], { type: "application/json" }))) return;
    globalThis
      .fetch?.(EVENTS_API, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
      .catch(() => {});
  } catch {
    /* sin métricas propias */
  }
}

/* Punto único de medición: GA4 + métricas propias. */
export function trackEvent(name, params = {}) {
  sendToGoogle(name, params);
  sendFirstParty(name, params);
}

/* ---------- WhatsApp ---------- */

/* true si el enlace abre un chat con Vínculos 360 (no "compartir" sin número). */
export function isBusinessWhatsAppUrl(href) {
  if (typeof href !== "string") return false;
  const match = href.match(/^https:\/\/(?:wa\.me|api\.whatsapp\.com\/send)\/?(\d*)/i);
  if (!match) return false;
  if (match[1]) return true;
  return /[?&]phone=\d+/.test(href);
}

let lastWhatsApp = 0;

export function trackWhatsApp(params = {}) {
  const now = Date.now();
  if (now - lastWhatsApp < 1500) return; // un clic = un evento
  lastWhatsApp = now;
  trackEvent("whatsapp_clicked", params);
}

let watching = false;
function watchWhatsAppClicks() {
  if (watching) return;
  watching = true;
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a[href]");
      if (link && isBusinessWhatsAppUrl(link.href)) trackWhatsApp({ language: document.documentElement.lang === "en" ? "en" : "es", entry_point: "boton" });
    },
    { capture: true }
  );
}
