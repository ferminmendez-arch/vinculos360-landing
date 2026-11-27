/* Pruebas del Analizador de factura de energía eléctrica (datos sintéticos). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeBill, validateAnalyzerInput } from "../src/lib/billAnalyzer.js";
import { ANALYZER_STRINGS } from "../src/lib/analyzerStrings.js";
import { INITIAL_STATE, answer, buildLeadPayload, nextStep, prefillFromAnalyzer } from "../src/lib/chatbot/flow.js";
import { toSheetPayload } from "../src/lib/chatbot/api.js";
import { handleEvent, handleLead } from "../api/src/lib/handlers.js";
import { leadToSheetBody, leadToTableEntity } from "../api/src/lib/sinks.js";
import {
  CONSENT_VERSION,
  compareToAverage,
  contractAnswerFromDate,
  contractStatus,
  effectiveCents,
  parseContractEnd,
  validateChatLead,
  validateEvent,
} from "../api/src/lib/rules.js";

const TODAY = new Date("2026-11-27T15:00:00Z");
const quiet = { info() {}, warn() {}, error() {} };
const allowAll = () => true;

/* ---------- Cálculo ---------- */

test("costo efectivo = factura ÷ kWh, redondeado a una décima de centavo", () => {
  assert.equal(effectiveCents("200", "1000"), 20);
  assert.equal(effectiveCents("$145.80", "1,123"), 13);
  assert.equal(effectiveCents("98.37", "612"), 16.1);
  // Fuera de 5–60 ¢/kWh casi seguro hay un error de captura.
  assert.equal(effectiveCents("20", "1000"), null);
  assert.equal(effectiveCents("700", "1000"), null);
  assert.equal(effectiveCents("abc", "1000"), null);
});

test("comparación con el promedio de Texas usa los mismos umbrales que el chatbot (±10 %)", () => {
  assert.deepEqual(compareToAverage(20), { level: "alta", rateCents: 20, avgCents: 16, diffPct: 25 });
  assert.equal(compareToAverage(17.5).level, "media");
  assert.equal(compareToAverage(14.4).level, "baja");
  assert.equal(compareToAverage(14.4).diffPct, -10);
  assert.equal(compareToAverage(null).level, "sin_datos");
});

test("validación: obligatorios, rangos, ZIP y fecha opcional", () => {
  assert.deepEqual(validateAnalyzerInput({ bill: "", kwh: "", zipCode: "", contractEnd: "" }, TODAY).errors, {
    bill: "bill_required",
    kwh: "kwh_required",
    zipCode: "zip_required",
  });
  assert.equal(validateAnalyzerInput({ bill: "5", kwh: "1000", zipCode: "77036" }, TODAY).errors.bill, "bill_low");
  assert.equal(validateAnalyzerInput({ bill: "200", kwh: "20000", zipCode: "77036" }, TODAY).errors.kwh, "kwh_high");
  assert.equal(validateAnalyzerInput({ bill: "15", kwh: "1000", zipCode: "77036" }, TODAY).errors.kwh, "rate_out_of_range");
  assert.equal(validateAnalyzerInput({ bill: "200", kwh: "1000", zipCode: "7703" }, TODAY).errors.zipCode, "zip_invalid");
  assert.equal(validateAnalyzerInput({ bill: "200", kwh: "1000", zipCode: "77036", contractEnd: "2026-02-30" }, TODAY).errors.contractEnd, "date_invalid");
  assert.deepEqual(validateAnalyzerInput({ bill: "$1,200.50", kwh: "4,000 kWh", zipCode: "77036", contractEnd: "" }, TODAY).values, {
    bill: "1200.5",
    kwh: "4000",
    zipCode: "77036",
    contractEnd: "",
  });
});

test("cada código de error tiene texto en español e inglés", () => {
  const codes = ["bill_required", "kwh_required", "number_invalid", "bill_low", "bill_high", "kwh_low", "kwh_high", "rate_out_of_range", "zip_required", "zip_invalid", "date_invalid"];
  for (const lang of ["es", "en"]) for (const c of codes) assert.ok(ANALYZER_STRINGS[lang].errors[c], `${lang}:${c}`);
});

test("vencimiento del contrato: ventana sin cargo (PUCT, 14 días), pronto, después y vencido", () => {
  assert.deepEqual(contractStatus("2026-12-05", TODAY), { status: "ventana", days: 8, date: "2026-12-05" });
  assert.equal(contractStatus("2026-12-11", TODAY).status, "ventana");
  assert.equal(contractStatus("2026-12-12", TODAY).status, "pronto");
  assert.equal(contractStatus("2027-01-26", TODAY).status, "pronto");
  assert.equal(contractStatus("2027-06-01", TODAY).status, "despues");
  assert.equal(contractStatus("2026-10-01", TODAY).status, "vencido");
  assert.equal(contractStatus("", TODAY).status, "sin_dato");
  assert.equal(parseContractEnd("2040-01-01", TODAY), null);
  assert.equal(contractAnswerFromDate("2026-12-05", TODAY), "vencepronto");
  assert.equal(contractAnswerFromDate("2027-06-01", TODAY), "vencedespues");
  assert.equal(contractAnswerFromDate("2026-10-01", TODAY), "sincontrato");
  assert.equal(contractAnswerFromDate("", TODAY), "");
});

test("resultado: zona de Texas, zona probablemente sin opción y fuera de Texas", () => {
  const r = analyzeBill({ bill: "200", kwh: "1000", zipCode: "77036", contractEnd: "2026-12-20" }, TODAY);
  assert.equal(r.cents, 20);
  assert.equal(r.comparison.level, "alta");
  assert.equal(r.zone, "texas");
  assert.equal(r.contract.status, "pronto");
  assert.equal(analyzeBill({ bill: "150", kwh: "1000", zipCode: "78701" }, TODAY).zone, "sin_opcion_probable");
  assert.equal(analyzeBill({ bill: "150", kwh: "1000", zipCode: "90210" }, TODAY).zone, "fuera_de_texas");
});

test("los textos del resultado no prometen ahorro ni nombran proveedores", () => {
  const forbidden = /garantiz|guarantee|ahorrar[áa]s|you will save|gratis|\bfree\b|xoom|acn\b|reliant|txu|luz\b/i;
  for (const lang of ["es", "en"]) {
    const s = ANALYZER_STRINGS[lang];
    const texts = [
      s.title, s.text, s.ctaTitle, s.ctaText, s.cta, s.ctaNote, s.eyebrow,
      ...Object.values(s.levels).flatMap((f) => Object.values(f({ diffPct: 25 }))),
      ...Object.values(s.contract).map((f) => f({ days: 8, date: "2026-12-05" })),
      ...Object.values(s.zones),
    ];
    for (const t of texts) assert.doesNotMatch(t, forbidden, `${lang}: ${t}`);
  }
  // El aviso sí menciona la garantía, pero para negarla.
  assert.match(ANALYZER_STRINGS.es.disclaimer, /no es igual a la tarifa[\s\S]*no una garantía de ahorro/);
  assert.match(ANALYZER_STRINGS.en.disclaimer, /isn't the same as your contract rate[\s\S]*not a guarantee of savings/);
});

/* ---------- Integración con el chatbot ---------- */

test("prefill: el chat empieza en Electricidad con factura, kWh, ZIP y vencimiento ya contestados", () => {
  const state = prefillFromAnalyzer({ bill: "200", kwh: "1000", zipCode: "77036", contractEnd: "2026-12-05" }, TODAY);
  assert.equal(state.serviceKey, "electricidad");
  assert.deepEqual(state.answers, { bill: "200", kwh: "1000", contract: "vencepronto" });
  assert.equal(state.zipCode, "77036");
  assert.equal(state.entry, "analizador");
  assert.equal(nextStep(state).id, "q:property");
  // Tras casa/negocio y decisión, sigue el nombre: no repite factura, kWh, contrato ni ZIP.
  let s = answer(state, "q:property", "casa");
  s = answer(s, "q:decision", "si");
  assert.equal(nextStep(s).id, "name");
});

test("prefill con datos fuera de rango no los usa (se vuelven a preguntar)", () => {
  const state = prefillFromAnalyzer({ bill: "99999", kwh: "1000", zipCode: "abc" }, TODAY);
  assert.deepEqual(state.answers, {});
  assert.equal(state.zipCode, "");
});

test("payload del chat lleva entry y contractEnd; un chat normal sigue igual", () => {
  const state = { ...prefillFromAnalyzer({ bill: "200", kwh: "1000", zipCode: "77036", contractEnd: "2026-12-05" }, TODAY), name: "Prueba QA" };
  const p = buildLeadPayload(state, { language: "es", tracking: { source: "facebook" }, elapsedMs: 9000, consent: true });
  assert.equal(p.entry, "analizador");
  assert.equal(p.contractEnd, "2026-12-05");
  const normal = buildLeadPayload(answer(INITIAL_STATE, "service", "internet"), { language: "es", tracking: {}, elapsedMs: 9000, consent: true });
  assert.equal(normal.entry, "chat");
  assert.equal(normal.contractEnd, "");
});

/* ---------- API y hoja ---------- */

const BODY = {
  serviceKey: "electricidad",
  answers: { property: "casa", decision: "si", bill: "200", kwh: "1000", contract: "vencepronto" },
  name: "Prueba QA",
  phone: "281-555-0107",
  zipCode: "77036",
  email: "",
  preferredContact: "whatsapp",
  consent: true,
  consentVersion: CONSENT_VERSION,
  language: "es",
  elapsedMs: 25000,
  company: "",
  source: "facebook",
  medium: "grupo",
  campaign: "negocios-latinos-houston",
  ad: "",
  fbclid: "",
  device: "Mobile",
  entry: "analizador",
  contractEnd: "2026-12-05",
};

test("la API valida entry/contractEnd; una fecha mal escrita se ignora sin bloquear el lead", () => {
  const ok = validateChatLead(BODY);
  assert.equal(ok.lead.entry, "analizador");
  assert.equal(ok.lead.contractEnd, "2026-12-05");
  const bad = validateChatLead({ ...BODY, entry: "<script>", contractEnd: "mañana" });
  assert.equal(bad.lead.entry, "chat");
  assert.equal(bad.lead.contractEnd, "");
  // La fecha solo aplica a electricidad.
  const internet = validateChatLead({ ...BODY, serviceKey: "internet", answers: { property: "casa", situation: "mejorar", usage: "trabajo", decision: "si" } });
  assert.equal(internet.lead.contractEnd, "");
});

test("hoja: columnas del analizador (Bill Amount, Monthly kWh, Effective Cost, Contract Expiration, Lead Source)", () => {
  const { lead, prequalified, savings } = validateChatLead(BODY);
  const body = leadToSheetBody(lead, { id: "id-1", receivedAt: "2026-11-27T15:00:00.000Z", prequalified, savings, tdu: "CenterPoint" });
  assert.equal(body.channel, "analizador");
  assert.equal(body.billAmount, "200");
  assert.equal(body.monthlyKwh, "1000");
  assert.equal(body.effectiveCentsKwh, "20");
  assert.equal(body.contractExpiration, "2026-12-05");
  assert.equal(body.leadSource, "Energy Bill Analyzer");
  assert.match(body.answers, /vence=2026-12-05; origen=analizador/);
  // Las 10 claves originales siguen presentes (receptor v1–v3 compatible).
  for (const k of ["name", "phone", "zipCode", "service", "source", "medium", "campaign", "ad", "fbclid", "device"]) assert.ok(k in body, k);
  const entity = leadToTableEntity(lead, { id: "id-1", receivedAt: "2026-11-27T15:00:00.000Z", prequalified, reasons: [], savings });
  assert.equal(entity.LeadSource, "Energy Bill Analyzer");
  assert.equal(entity.ContractExpiration, "2026-12-05");
});

test("hoja: un lead del chat normal queda como Chatbot, sin datos de factura si no los dio", () => {
  const { lead, prequalified, savings } = validateChatLead({ ...BODY, entry: undefined, contractEnd: undefined, answers: { ...BODY.answers, bill: "nose", kwh: undefined } });
  const body = leadToSheetBody(lead, { id: "id-2", receivedAt: "2026-11-27T15:00:00.000Z", prequalified, savings });
  assert.equal(body.channel, "chatbot");
  assert.equal(body.leadSource, "Chatbot");
  assert.equal(body.billAmount, "");
  assert.equal(body.effectiveCentsKwh, "");
});

test("respaldo directo a Apps Script (sin API) también lleva los datos del analizador", () => {
  const sheet = toSheetPayload({ ...BODY, phone: "(281) 555-0107" });
  assert.equal(sheet.channel, "analizador");
  assert.equal(sheet.leadSource, "Energy Bill Analyzer");
  assert.equal(sheet.effectiveCentsKwh, "20");
  assert.equal(sheet.contractExpiration, "2026-12-05");
  assert.match(sheet.answers, /origen=analizador/);
});

test("de punta a punta: la API guarda el lead del analizador y confirma solo después de guardar", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), body: JSON.parse(opts.body) });
    if (String(url).includes("powertochoose")) return { ok: true, status: 200, json: async () => [{ company_tdu_name: "CENTERPOINT ENERGY HOUSTON ELECTRIC LLC" }] };
    return { status: 200, text: async () => '{"ok":true,"result":"success","id":"sheet-9"}' };
  };
  const headers = new Headers({ origin: "https://www.vinculos360.com", "x-forwarded-for": "203.0.113.7" });
  const res = await handleLead({ headers, text: async () => JSON.stringify(BODY) }, { env: {}, fetchImpl, log: quiet, limiter: allowAll });
  assert.equal(res.status, 200);
  assert.equal(res.jsonBody.result, "success");
  const sent = calls.find((c) => c.url.includes("script.google.com")).body;
  assert.equal(sent.leadSource, "Energy Bill Analyzer");
  assert.equal(sent.device, "Mobile · Chatbot · Ahorro: alta");

  // Si la hoja falla, la API NO confirma (el sitio no abre WhatsApp como si estuviera guardado).
  const failing = async (url) =>
    String(url).includes("powertochoose") ? { ok: false, status: 500 } : { status: 200, text: async () => '{"ok":false,"result":"error","reason":"busy"}' };
  const res2 = await handleLead({ headers, text: async () => JSON.stringify(BODY) }, { env: {}, fetchImpl: failing, log: quiet, limiter: allowAll });
  assert.equal(res2.status, 502);
  assert.equal(res2.jsonBody.ok, false);
});

test("eventos del analizador se aceptan; nombres desconocidos no", async () => {
  for (const event of ["analyzer_view", "analyzer_calc", "analyzer_cta"]) assert.ok(validateEvent({ event }).event, event);
  assert.ok(validateEvent({ event: "analyzer_delete" }).error);
  const headers = new Headers({ origin: "https://www.vinculos360.com" });
  const res = await handleEvent(
    { headers, text: async () => JSON.stringify({ event: "analyzer_calc", language: "es", serviceKey: "electricidad", bill: "200" }) },
    { env: { CHAT_EVENTS_TO_SHEET: "false" }, log: quiet, limiter: allowAll }
  );
  assert.equal(res.status, 202);
});
