/* =========================================================
   ANALIZADOR DE FACTURA DE ENERGÍA ELÉCTRICA (lógica pura)

   Calcula el costo promedio efectivo por kWh de la factura del
   visitante y lo compara con el promedio residencial de Texas (EIA).
   No usa tarifas de ningún proveedor ni promete ahorros: la
   comparación con planes reales la hace una persona después,
   con la solicitud de revisión personalizada.

   Todo se calcula en el navegador. Nada se envía hasta que el
   visitante pide la comparación y completa el chat con su
   consentimiento.
========================================================= */

import {
  QUESTIONS,
  REMINDER_CONSENT_VERSION,
  SITE_URL_FOR_SHARE,
  TX_RESIDENTIAL_AVG,
  checkEmail,
  checkName,
  cleanName,
  checkPhone,
  checkZip,
  contractAnswerFromDate,
  compareToAverage,
  contractStatus,
  digitsOnly,
  effectiveCents,
  isLikelyNoChoiceZip,
  isTexasZip,
  parseAmount,
  parseContractEnd,
} from "../../api/src/lib/rules.js";

export { TX_RESIDENTIAL_AVG };

const BILL = QUESTIONS.electricidad.find((q) => q.id === "bill");
const KWH = QUESTIONS.electricidad.find((q) => q.id === "kwh");

/* Valida lo que escribió el visitante. Devuelve { values } o { errors: { campo: código } }. */
export function validateAnalyzerInput({ bill, kwh, zipCode, contractEnd }, today = new Date()) {
  const errors = {};
  const b = parseAmount(bill);
  if (!String(bill ?? "").trim()) errors.bill = "bill_required";
  else if (b === null) errors.bill = "number_invalid";
  else if (Number(b) < BILL.min) errors.bill = "bill_low";
  else if (Number(b) > BILL.max) errors.bill = "bill_high";

  const k = parseAmount(kwh);
  if (!String(kwh ?? "").trim()) errors.kwh = "kwh_required";
  else if (k === null) errors.kwh = "number_invalid";
  else if (Number(k) < KWH.min) errors.kwh = "kwh_low";
  else if (Number(k) > KWH.max) errors.kwh = "kwh_high";

  const zipError = checkZip(zipCode);
  if (zipError) errors.zipCode = zipError;

  const end = String(contractEnd ?? "").trim();
  if (end && !parseContractEnd(end, today)) errors.contractEnd = "date_invalid";

  if (!errors.bill && !errors.kwh && effectiveCents(b, k) === null) errors.kwh = "rate_out_of_range";

  if (Object.keys(errors).length) return { errors };
  return { values: { bill: b, kwh: k, zipCode: digitsOnly(zipCode), contractEnd: end ? parseContractEnd(end, today) : "" } };
}

/* Resultado completo para mostrar. Solo se llama con valores ya validados. */
export function analyzeBill({ bill, kwh, zipCode, contractEnd }, today = new Date()) {
  const cents = effectiveCents(bill, kwh);
  const comparison = compareToAverage(cents);
  const texas = isTexasZip(zipCode);
  return {
    cents,
    comparison,
    zone: !texas ? "fuera_de_texas" : isLikelyNoChoiceZip(zipCode) ? "sin_opcion_probable" : "texas",
    contract: contractStatus(contractEnd, today),
  };
}

/* ---------- Recordatorio de vencimiento ---------- */

/* Valida el formulario del recordatorio. La fecha debe ser futura (hoy o después). */
export function validateReminder({ contractEnd, name, phone, email, consent }, today = new Date()) {
  const errors = {};
  const raw = String(contractEnd ?? "").trim();
  const iso = parseContractEnd(raw, today);
  if (!raw) errors.contractEnd = "date_required";
  else if (!iso) errors.contractEnd = "date_invalid";
  else if (contractStatus(iso, today).status === "vencido") errors.contractEnd = "date_past";
  const nameError = checkName(name);
  if (nameError) errors.name = nameError === "name_long" ? "name_invalid" : nameError;
  const phoneError = checkPhone(phone);
  if (phoneError) errors.phone = phoneError;
  const emailError = checkEmail(email, false);
  if (emailError) errors.email = "email_invalid";
  if (consent !== true) errors.consent = "consent_required";
  return Object.keys(errors).length ? { errors } : { values: { contractEnd: iso, name: cleanName(name), phone, email: String(email ?? "").trim() } };
}

/* Cuerpo para /api/leads (mismo receptor y hoja que el chat). */
export function buildReminderPayload(analyzer, reminder, { language = "es", tracking = {}, elapsedMs = 0 } = {}, today = new Date()) {
  const answers = { bill: analyzer.bill };
  if (analyzer.kwh) answers.kwh = analyzer.kwh;
  const contract = contractAnswerFromDate(reminder.contractEnd, today);
  if (contract) answers.contract = contract;
  return {
    serviceKey: "electricidad",
    answers,
    name: reminder.name,
    phone: reminder.phone,
    zipCode: analyzer.zipCode,
    email: reminder.email || "",
    preferredContact: "whatsapp",
    consent: true,
    consentVersion: REMINDER_CONSENT_VERSION,
    language,
    elapsedMs: Math.round(elapsedMs),
    company: "",
    entry: "recordatorio",
    contractEnd: reminder.contractEnd,
    ...tracking,
  };
}

/* Enlace para compartir la calculadora, con atribución propia. */
export function shareUrl(lang = "es") {
  return `${SITE_URL_FOR_SHARE}/${lang === "en" ? "en/" : ""}?utm_source=compartir&utm_medium=analizador&utm_campaign=analizador-compartir#analizador`;
}
