/* =========================================================
   CONFIGURACIÓN DEL SITIO
   Valores públicos (no son secretos): se incluyen en el bundle
   que descarga el navegador.
========================================================= */

export const SITE_URL = "https://www.vinculos360.com";

export const WHATSAPP_NUMBER = "12818257327";
export const PHONE_E164 = "+12818257327";
export const PHONE_DISPLAY = "(281) 825-7327";

export const FACEBOOK_URL = "https://www.facebook.com/vinculos360";

/*
  Endpoint de Google Apps Script (/exec) que guarda los leads en la
  hoja "Vínculos 360 — Leads" (pestaña "Leads"). Código del receptor:
  automation/apps-script/receptor/Receptor.js. Se puede sobrescribir con VITE_LEADS_ENDPOINT (por ejemplo,
  para apuntar un entorno de vista previa a una hoja de pruebas).
*/
const DEFAULT_LEADS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwEVckFhVLHNjrMFNDbYe0N88ikApHK64Z2oB2RJH18nDqA7r02xrwSxYE8L5dzhLNm/exec";

export const LEADS_ENDPOINT =
  import.meta.env?.VITE_LEADS_ENDPOINT || DEFAULT_LEADS_ENDPOINT;

/* Tiempo máximo de espera al guardar un lead. */
export const LEAD_TIMEOUT_MS = 15000;

/* Ventana para evitar registrar dos veces la misma solicitud. */
export const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
