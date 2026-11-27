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
  television: "Televisión",
  celular: "Telefonía celular",
  identidad: "Protección de identidad",
  pagos: "Procesamiento de pagos",
  otros: "Otros servicios",
};

export const SERVICE_KEYS = Object.keys(SERVICE_VALUES);

/* Preguntas por servicio, en orden. Cada opción es un código. */
export const QUESTIONS = {
  electricidad: [
    { id: "property", options: ["casa", "negocio"] },
    { id: "decision", options: ["si", "compartida", "no"] },
    // Preguntas numéricas: el visitante escribe un número o elige "No lo sé" ("nose").
    { id: "bill", kind: "number", min: 10, max: 3000 },
    { id: "kwh", kind: "number", min: 50, max: 10000, askIf: (a) => isNumberAnswer(a.bill) },
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
  television: [
    { id: "property", options: ["casa", "negocio"] },
    { id: "tvCurrent", options: ["cable", "satelite", "streaming", "ninguno"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
  celular: [
    { id: "lines", options: ["una", "dosatres", "cuatromas"] },
    { id: "phonePlan", options: ["prepago", "contrato", "sinservicio"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
  identidad: [
    { id: "coverage", options: ["solo", "pareja", "familia"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
  // Solo para negocios.
  pagos: [
    { id: "businessType", options: ["restaurante", "tienda", "servicios", "otro"] },
    { id: "cardVolume", options: ["menos5k", "5ka20k", "mas20k", "nose"] },
    { id: "currentPayments", options: ["tiene", "notiene"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
  otros: [
    { id: "otherType", options: ["fija", "otro"] },
    { id: "property", options: ["casa", "negocio"] },
    { id: "decision", options: ["si", "compartida", "no"] },
  ],
};

export const SKIP = "nose";

/* Precio promedio residencial de electricidad en Texas, todo incluido
   (energía, entrega e impuestos). Fuente: U.S. Energy Information
   Administration (EIA), formulario EIA-861M; promedio de 12 meses
   a septiembre de 2026. Es un dato público del gobierno, no una tarifa
   de ningún proveedor. Actualizar cada trimestre. */
export const TX_RESIDENTIAL_AVG = { cents: 16.0, periodEs: "12 meses a sep. 2026", periodEn: "12 months to Sep 2026" };

export function isNumberAnswer(value) {
  return value !== undefined && value !== "" && value !== SKIP && Number.isFinite(Number(value));
}

/* "$1,245.50" → "1245.5"; devuelve null si no es un número. */
export function parseAmount(raw) {
  const cleaned = String(raw ?? "").replace(/[$,\s]/g, "").replace(/kwh$/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return String(Number(cleaned));
}

/* Compara el precio por kWh que paga el visitante (factura ÷ kWh) con el
   promedio residencial de Texas. Solo para electricidad en casa.
   level: "alta" (≥10 % arriba), "media", "baja" (≥10 % abajo) o "sin_datos". */
export function savingsEstimate({ serviceKey, answers = {} }, avg = TX_RESIDENTIAL_AVG) {
  if (serviceKey !== "electricidad" || answers.property !== "casa") return { level: "sin_datos" };
  if (!isNumberAnswer(answers.bill) || !isNumberAnswer(answers.kwh)) return { level: "sin_datos" };
  const rate = (Number(answers.bill) / Number(answers.kwh)) * 100;
  // Fuera de este rango casi seguro hay un dato mal escrito.
  if (!Number.isFinite(rate) || rate < 5 || rate > 60) return { level: "sin_datos" };
  const ratio = rate / avg.cents;
  const level = ratio >= 1.1 ? "alta" : ratio <= 0.9 ? "baja" : "media";
  return { level, rateCents: Math.round(rate * 10) / 10, avgCents: avg.cents };
}

/* Texto de la columna Device en la hoja: "Mobile · Chatbot · Ahorro: alta". */
export function sheetDevice(device, level) {
  const parts = [device, "Chatbot"];
  if (["alta", "media", "baja"].includes(level)) parts.push(`Ahorro: ${level}`);
  return parts.filter(Boolean).join(" · ");
}

export const CONTACT_METHODS = ["whatsapp", "llamada", "texto", "correo"];
export const LANGS = ["es", "en"];
export const DEVICES = ["Mobile", "Tablet", "Desktop"];

/* Versión del texto de consentimiento. Si cambias el texto en
   src/lib/chatbot/strings.js, sube esta versión. */
export const CONSENT_VERSION = "2026-11-v1";

export const EVENT_NAMES = [
  "chat_open",
  "chat_start",
  "chat_complete",
  "chat_qualified",
  // Analizador de factura (nov. 2026): vista de la sección, cálculo hecho y clic en "comparación personalizada".
  "analyzer_view",
  "analyzer_calc",
  "analyzer_cta",
];

/* Punto de entrada del lead. "analizador" = llegó desde el Analizador de factura. */
export const ENTRY_POINTS = ["chat", "analizador"];
export const ENTRY_LABELS = { chat: "Chatbot", analizador: "Energy Bill Analyzer" };

/* ---------- Analizador de factura ---------- */

/* Costo promedio efectivo (¢/kWh) = total del servicio eléctrico ÷ kWh.
   Incluye cargos fijos, de entrega e impuestos: NO es la tarifa del contrato. */
export function effectiveCents(bill, kwh) {
  const b = Number(parseAmount(bill));
  const k = Number(parseAmount(kwh));
  if (!(b > 0) || !(k > 0)) return null;
  const rate = (b / k) * 100;
  if (!Number.isFinite(rate) || rate < 5 || rate > 60) return null; // casi seguro un dato mal escrito
  return Math.round(rate * 10) / 10;
}

/* Comparación con el promedio residencial de Texas (EIA). Mismos umbrales que el chatbot. */
export function compareToAverage(cents, avg = TX_RESIDENTIAL_AVG) {
  if (cents == null) return { level: "sin_datos" };
  const ratio = cents / avg.cents;
  const level = ratio >= 1.1 ? "alta" : ratio <= 0.9 ? "baja" : "media";
  return { level, rateCents: cents, avgCents: avg.cents, diffPct: Math.round((ratio - 1) * 100) };
}

/* "2027-01-15" válido (fecha real, entre hace 2 años y dentro de 6). */
export function parseContractEnd(value, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  const year = today.getUTCFullYear();
  if (Number(m[1]) < year - 2 || Number(m[1]) > year + 6) return null;
  return m[0];
}

/* Estado del contrato según su fecha de vencimiento.
   PUCT: el proveedor avisa al menos 30 días antes y el cliente residencial puede cambiar
   sin cargo por cancelación anticipada desde 14 días antes del vencimiento.
   status: "vencido" | "ventana" (≤14 días) | "pronto" (≤60) | "despues" | "sin_dato". */
export function contractStatus(contractEnd, today = new Date()) {
  const iso = parseContractEnd(contractEnd, today);
  if (!iso) return { status: "sin_dato" };
  const end = Date.parse(`${iso}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((end - start) / 86400000);
  const status = days < 0 ? "vencido" : days <= 14 ? "ventana" : days <= 60 ? "pronto" : "despues";
  return { status, days, date: iso };
}

/* Respuesta "contract" del chatbot a partir de la fecha del analizador. */
export function contractAnswerFromDate(contractEnd, today = new Date()) {
  const c = contractStatus(contractEnd, today);
  if (c.status === "sin_dato") return "";
  if (c.status === "vencido") return "sincontrato";
  return c.status === "despues" ? "vencedespues" : "vencepronto";
}

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
   "Calificado" que el dueño pone en la pestaña Seguimiento.
   Desde nov. 2026 los negocios también cuentan (decisión del dueño). */

export function qualify({ serviceKey, answers = {}, zipCode, consent }) {
  const reasons = [];
  if (!consent) reasons.push("sin_consentimiento");
  if (answers.decision === "no") reasons.push("no_decide");
  if (serviceKey === "electricidad") {
    if (!isTexasZip(zipCode)) reasons.push("fuera_de_texas");
    else if (isLikelyNoChoiceZip(zipCode)) reasons.push("zona_sin_opcion_probable");
  }
  if (serviceKey === "seguridad" && answers.timeline === "explorando") reasons.push("solo_explorando");
  return { prequalified: reasons.length === 0, reasons };
}

/* Resumen compacto de respuestas para la hoja: "property=casa; decision=si". */
export function answersSummary(serviceKey, answers = {}, { tdu = "", entry = "", contractEnd = "" } = {}) {
  const parts = (QUESTIONS[serviceKey] || []).filter((q) => answers[q.id]).map((q) => `${q.id}=${answers[q.id]}`);
  const est = savingsEstimate({ serviceKey, answers });
  if (est.level !== "sin_datos") parts.push(`precio_kwh=${est.rateCents}c`, `oportunidad=${est.level}`);
  if (tdu) parts.push(`distribuidora=${String(tdu).replace(/[;=]/g, " ")}`);
  if (contractEnd) parts.push(`vence=${contractEnd}`);
  if (entry && entry !== "chat") parts.push(`origen=${entry}`);
  return parts.join("; ");
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
    if (q.askIf && !q.askIf(answers)) continue; // pregunta que no aplica: se ignora lo que venga
    const value = String(raw[q.id] ?? "");
    if (q.kind === "number") {
      const n = value === SKIP ? SKIP : parseAmount(value);
      if (n === null || (n !== SKIP && (Number(n) < q.min || Number(n) > q.max))) return { error: `invalid_answer_${q.id}` };
      answers[q.id] = n;
      continue;
    }
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
  const entry = ENTRY_POINTS.includes(data.entry) ? data.entry : "chat";
  // Fecha opcional del analizador: si viene mal escrita se ignora (no bloquea el lead).
  const contractEnd = serviceKey === "electricidad" ? parseContractEnd(data.contractEnd) || "" : "";

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
    entry,
    contractEnd,
  };
  return { lead, savings: savingsEstimate({ serviceKey, answers }), ...qualify({ serviceKey, answers, zipCode: lead.zipCode, consent: true }) };
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
