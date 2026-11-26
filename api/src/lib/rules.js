/* =========================================================
   REGLAS DEL CHATBOT (compartidas por la API y el sitio)

   Este archivo no tiene dependencias: lo importan la Azure Function
   (api/src/functions/api.js) y el widget del sitio
   (src/lib/chatbot/flow.js), para que la validación y la
   precalificación sean idénticas en el navegador y en el servidor.

   Las respuestas se guardan como CÓDIGOS (no texto libre), así no
   entra texto arbitrario a la hoja ni a Azure Storage.
========================================================= */

/* Valor que se guarda en la hoja (en español, igual que el formulario). */
export const SERVICE_VALUES = {
  electricidad: "Electricidad",
  internet: "Internet",
  seguridad: "Seguridad y monitoreo",
  otros: "Otros servicios",
};

export const SERVICE_KEYS = Object.keys(SERVICE_VALUES);

/* Preguntas por servicio, en orden. Cada opción es un código. */
export const QUESTIONS = {
  electricidad: [
    { id: "property", options: ["casa", "negocio"] },
    { id: "decision", options: ["si", "compartida", "no"] },
    { id: "bill", options: ["menos100", "100a200", "mas200", "nose"] },
    { id: "contract", options: ["sincontrato", "vencepronto", "vencedespues", "nose"] },
  ],
  internet: [
    { id: "property", options: ["casa", "negocio"] },
    { id: "situation", options: ["sinservicio", "mejorar", "mudanza", "otra"] },
    { id: "usage", options: ["trabajo", "streaming", "basico"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
  seguridad: [
    { id: "housing", options: ["propia", "rentada", "apartamento", "negocio"] },
    { id: "interest", options: ["camaras", "monitoreo", "ambos", "nosegura"] },
    { id: "timeline", options: ["pronto", "1a3meses", "explorando"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
  otros: [
    { id: "otherType", options: ["movil", "fija", "otro"] },
    { id: "property", options: ["casa", "negocio"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
};

export const CONTACT_METHODS = ["whatsapp", "llamada", "texto", "correo"];
export const LANGS = ["es", "en"];
export const DEVICES = ["Mobile", "Tablet", "Desktop"];

/* Versión del texto de consentimiento. Si cambias el texto en
   src/lib/chatbot/strings.js, sube esta versión. */
export const CONSENT_VERSION = "2026-11-v1";

export const EVENT_NAMES = ["chat_open", "chat_start", "chat_complete", "chat_qualified"];

/* Prefijos de ZIP de Texas donde la mayor parte del área no tiene
   opción de proveedor de electricidad (Austin, San Antonio, El Paso).
   Mismo criterio que el agente de leads (LeadAgent.js). */
export const NO_CHOICE_ZIP_PREFIXES = ["782", "787", "798", "799"];

/* ---------- Normalización ---------- */

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeUsPhone(value) {
  let d = digitsOnly(value);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

export function formatUsPhone(value) {
  const d = normalizeUsPhone(value).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function cleanName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function cleanEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

/* ---------- Validación de cada dato (códigos de error) ---------- */

export function checkName(value) {
  const n = cleanName(value);
  if (!n) return "name_required";
  if (n.length < 2 || !/\p{L}/u.test(n)) return "name_invalid";
  if (n.length > 80) return "name_long";
  if (/[<>{}=]|https?:|www\./i.test(n)) return "name_invalid";
  return null;
}

export function checkPhone(value) {
  const p = normalizeUsPhone(value);
  if (!p) return "phone_required";
  if (p.length !== 10 || /^[01]/.test(p)) return "phone_invalid";
  return null;
}

export function checkZip(value) {
  const z = digitsOnly(value);
  if (!z) return "zip_required";
  if (z.length !== 5 || String(value).trim().length > 10) return "zip_invalid";
  return null;
}

export function checkEmail(value, required) {
  const e = cleanEmail(value);
  if (!e) return required ? "email_required" : null;
  if (e.length > 120 || !EMAIL_PATTERN.test(e)) return "email_invalid";
  return null;
}

/* ---------- Geografía ---------- */

export function isTexasZip(zip) {
  const z = digitsOnly(zip);
  if (z.length !== 5) return false;
  const n = Number(z);
  return (n >= 75000 && n <= 79999) || (n >= 88500 && n <= 88599);
}

export function isLikelyNoChoiceZip(zip) {
  const z = digitsOnly(zip);
  return NO_CHOICE_ZIP_PREFIXES.some((p) => z.startsWith(p));
}

/* ---------- Precalificación ----------
   "Precalificado" = vale la pena contactar ya. No sustituye al estado
   "Calificado" que el dueño pone en la pestaña Seguimiento. */

export function qualify({ serviceKey, answers = {}, zipCode, consent }) {
  const reasons = [];
  if (!consent) reasons.push("sin_consentimiento");
  if (answers.decision === "no") reasons.push("no_decide");
  if (answers.property === "negocio" || answers.housing === "negocio") reasons.push("negocio");
  if (serviceKey === "electricidad") {
    if (!isTexasZip(zipCode)) reasons.push("fuera_de_texas");
    else if (isLikelyNoChoiceZip(zipCode)) reasons.push("zona_sin_opcion_probable");
  }
  if (serviceKey === "seguridad" && answers.timeline === "explorando") reasons.push("solo_explorando");
  return { prequalified: reasons.length === 0, reasons };
}

/* Resumen compacto de respuestas para la hoja: "property=casa; decision=si". */
export function answersSummary(serviceKey, answers = {}) {
  return (QUESTIONS[serviceKey] || [])
    .filter((q) => answers[q.id])
    .map((q) => `${q.id}=${answers[q.id]}`)
    .join("; ");
}

/* ---------- Validación completa (servidor y navegador) ----------
   Devuelve { lead } normalizado o { error: "código" }. */

const SHORT_TEXT = 200;

function shortText(value) {
  return String(value ?? "").replace(/\p{Cc}/gu, " ").trim().slice(0, SHORT_TEXT);
}

export function validateChatLead(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "invalid_body" };

  const serviceKey = String(data.serviceKey || "");
  if (!SERVICE_KEYS.includes(serviceKey)) return { error: "invalid_service" };

  const raw = data.answers && typeof data.answers === "object" && !Array.isArray(data.answers) ? data.answers : {};
  const answers = {};
  for (const q of QUESTIONS[serviceKey]) {
    const value = String(raw[q.id] ?? "");
    if (!q.options.includes(value)) return { error: `invalid_answer_${q.id}` };
    answers[q.id] = value;
  }

  const nameError = checkName(data.name);
  if (nameError) return { error: nameError };
  const phoneError = checkPhone(data.phone);
  if (phoneError) return { error: phoneError };
  const zipError = checkZip(data.zipCode);
  if (zipError) return { error: zipError };

  const preferredContact = String(data.preferredContact || "");
  if (!CONTACT_METHODS.includes(preferredContact)) return { error: "invalid_contact_method" };
  const emailError = checkEmail(data.email, preferredContact === "correo");
  if (emailError) return { error: emailError };

  if (data.consent !== true) return { error: "consent_required" };
  if (String(data.consentVersion || "") !== CONSENT_VERSION) return { error: "consent_version" };

  const language = LANGS.includes(data.language) ? data.language : "es";
  const device = DEVICES.includes(data.device) ? data.device : "";

  const lead = {
    serviceKey,
    service: SERVICE_VALUES[serviceKey],
    answers,
    name: cleanName(data.name),
    phone: formatUsPhone(data.phone),
    zipCode: digitsOnly(data.zipCode),
    email: cleanEmail(data.email),
    preferredContact,
    consent: true,
    consentVersion: CONSENT_VERSION,
    language,
    source: shortText(data.source) || "Direct",
    medium: shortText(data.medium),
    campaign: shortText(data.campaign),
    ad: shortText(data.ad),
    fbclid: shortText(data.fbclid),
    device,
  };
  return { lead, ...qualify({ serviceKey, answers, zipCode: lead.zipCode, consent: true }) };
}

/* Evento de métricas: nunca lleva datos personales. */
export function validateEvent(data) {
  if (!data || typeof data !== "object") return { error: "invalid_body" };
  const event = String(data.event || "");
  if (!EVENT_NAMES.includes(event)) return { error: "invalid_event" };
  const language = LANGS.includes(data.language) ? data.language : "es";
  const serviceKey = SERVICE_KEYS.includes(data.serviceKey) ? data.serviceKey : "";
  return { event: { event, language, serviceKey } };
}
