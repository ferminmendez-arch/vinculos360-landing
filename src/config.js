/* =========================================================
   CONFIGURACIÓN DEL SITIO
   Valores públicos (no son secretos): se incluyen en el bundle
   que descarga el navegador.
========================================================= */

export const SITE_URL = "https://www.vinculos360.com";

export const WHATSAPP_NUMBER = "12818257327";
export const PHONE_E164 = "+12818257327";
export const PHONE_DISPLAY = "(281) 825-7327";

/*
  Endpoint de Google Apps Script (/exec) que guarda los leads en la
  hoja "Leads". Se puede sobrescribir con VITE_LEADS_ENDPOINT (por ejemplo,
  para apuntar un entorno de vista previa a una hoja de pruebas).
*/
const DEFAULT_LEADS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzZUfbdvaZ22Hark9E-mcDxPLifgwZaWYvVcRBuxXG6D2MgWnpMAzPYHp6Y5QFKySRT/exec";

export const LEADS_ENDPOINT =
  import.meta.env?.VITE_LEADS_ENDPOINT || DEFAULT_LEADS_ENDPOINT;

/* Tiempo máximo de espera al guardar un lead. */
export const LEAD_TIMEOUT_MS = 15000;

/* Ventana para evitar registrar dos veces la misma solicitud. */
export const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

export const DEFAULT_WHATSAPP_MESSAGE =
  "Hola, vi Vínculos 360 y quisiera información sobre servicios para mi hogar.";
