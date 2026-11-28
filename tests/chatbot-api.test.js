/* Pruebas de la Azure Function del chatbot (lógica pura, sin el host de Azure). */
import { createHmac } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, clientIp, handleEvent, handleHealth, handleLead, isAllowedOrigin } from "../api/src/lib/handlers.js";
import { interpretSheetResponse, leadToSheetBody, leadToTableEntity } from "../api/src/lib/sinks.js";
import { CONSENT_VERSION, validateChatLead, validateEvent } from "../api/src/lib/rules.js";

const quiet = { info() {}, warn() {}, error() {} };
const allowAll = () => true;

const BODY = {
  serviceKey: "electricidad",
  answers: { property: "casa", decision: "si", bill: "$200", kwh: "1,000", contract: "sincontrato" },
  name: "Prueba QA",
  phone: "281-555-0100",
  zipCode: "77494",
  email: "",
  preferredContact: "whatsapp",
  consent: true,
  consentVersion: CONSENT_VERSION,
  language: "es",
  elapsedMs: 25000,
  company: "",
  source: "facebook",
  medium: "organic",
  campaign: "luz-texas",
  ad: "",
  fbclid: "",
  device: "Mobile",
};

function request(body, headers = {}) {
  const h = new Headers({ origin: "https://www.vinculos360.com", "x-forwarded-for": "203.0.113.9:443", ...headers });
  return { headers: h, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
}

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : null });
    const handler = routes.find(([match]) => String(url).includes(match));
    if (!handler) throw new TypeError("no route");
    return handler[1](url, opts);
  };
  fn.calls = calls;
  return fn;
}

const sheetOk = () => ({ status: 200, text: async () => '{"ok":true,"result":"success","id":"sheet-1"}' });
const sheetFail = () => ({ status: 200, text: async () => '{"ok":false,"result":"error","reason":"busy"}' });
const tableOk = () => ({ status: 204, text: async () => "" });
const tableFail = () => ({ status: 403, text: async () => "AuthorizationPermissionMismatch" });

const SAS = "https://acct.table.core.windows.net/chatleads?sv=2019-02-02&tn=chatleads&sp=a&sig=x";
const EVENTS_SAS = "https://acct.table.core.windows.net/chatevents?sv=2019-02-02&tn=chatevents&sp=a&sig=y";

test("guarda en la hoja (por defecto) y confirma con id", async () => {
  const ptc = () => ({ ok: true, status: 200, json: async () => [{ company_tdu_name: "CENTERPOINT ENERGY HOUSTON ELECTRIC LLC" }, { company_tdu_name: "CENTERPOINT ENERGY HOUSTON ELECTRIC LLC" }] });
  const fetchImpl = fakeFetch([["script.google.com", sheetOk], ["powertochoose.org", ptc]]);
  const res = await handleLead(request(BODY), { env: {}, fetchImpl, log: quiet, limiter: allowAll });
  assert.equal(res.status, 200);
  assert.equal(res.jsonBody.ok, true);
  assert.equal(res.jsonBody.result, "success");
  assert.equal(res.jsonBody.prequalified, true);
  assert.deepEqual(res.jsonBody.saved, ["sheet"]);
  const sent = fetchImpl.calls.find((c) => c.url.includes("script.google.com")).body;
  assert.equal(sent.name, "Prueba QA");
  assert.equal(sent.phone, "(281) 555-0100");
  assert.equal(sent.service, "Electricidad");
  assert.equal(sent.device, "Mobile · Chatbot · Ahorro: alta");
  assert.equal(sent.qualification, "Precalificado");
  assert.equal(sent.answers, "property=casa; decision=si; bill=200; kwh=1000; contract=sincontrato; precio_kwh=20c; oportunidad=alta; distribuidora=CenterPoint");
  assert.equal(res.jsonBody.savings, "alta");
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("con LEADS_TABLE_SAS_URL guarda en ambas; si una falla igual confirma", async () => {
  const both = fakeFetch([["script.google.com", sheetOk], ["table.core.windows.net", tableOk]]);
  const r1 = await handleLead(request(BODY), { env: { LEADS_TABLE_SAS_URL: SAS }, fetchImpl: both, log: quiet, limiter: allowAll });
  assert.deepEqual(r1.jsonBody.saved.sort(), ["sheet", "table"]);
  const entity = both.calls.find((c) => c.url.includes("table")).body;
  assert.equal(entity.Channel, "chatbot");
  assert.equal(entity.Consent, true);
  assert.equal(entity.ConsentVersion, CONSENT_VERSION);
  assert.match(entity.PartitionKey, /^\d{4}-\d{2}$/);

  const sheetDown = fakeFetch([["script.google.com", sheetFail], ["table.core.windows.net", tableOk]]);
  const r2 = await handleLead(request(BODY), { env: { LEADS_TABLE_SAS_URL: SAS }, fetchImpl: sheetDown, log: quiet, limiter: allowAll });
  assert.equal(r2.status, 200);
  assert.deepEqual(r2.jsonBody.saved, ["table"]);
});

test("si ningún destino guarda, NO confirma (502 storage_unavailable)", async () => {
  const fetchImpl = fakeFetch([["script.google.com", sheetFail], ["table.core.windows.net", tableFail]]);
  const res = await handleLead(request(BODY), { env: { LEADS_TABLE_SAS_URL: SAS }, fetchImpl, log: quiet, limiter: allowAll });
  assert.equal(res.status, 502);
  assert.equal(res.jsonBody.ok, false);
  assert.equal(res.jsonBody.reason, "storage_unavailable");
  const net = await handleLead(request(BODY), { env: {}, fetchImpl: async () => { throw new TypeError("down"); }, log: quiet, limiter: allowAll });
  assert.equal(net.status, 502);
});

test("sin destinos configurados responde 503", async () => {
  const res = await handleLead(request(BODY), { env: { LEADS_SHEET_ENABLED: "false" }, fetchImpl: fakeFetch([]), log: quiet, limiter: allowAll });
  assert.equal(res.status, 503);
});

test("anti-spam: campo trampa o envío demasiado rápido → éxito falso, nada se guarda", async () => {
  for (const body of [{ ...BODY, company: "ACME" }, { ...BODY, elapsedMs: 800 }, { ...BODY, elapsedMs: undefined }]) {
    const fetchImpl = fakeFetch([["script.google.com", sheetOk]]);
    const res = await handleLead(request(body), { env: {}, fetchImpl, log: quiet, limiter: allowAll });
    assert.equal(res.status, 200);
    assert.equal(res.jsonBody.id, null);
    assert.equal(fetchImpl.calls.length, 0);
  }
});

test("valida datos, consentimiento y tamaño del cuerpo", async () => {
  const cases = [
    [{ ...BODY, consent: false }, "consent_required"],
    [{ ...BODY, consentVersion: "viejo" }, "consent_version"],
    [{ ...BODY, phone: "123" }, "phone_invalid"],
    [{ ...BODY, zipCode: "7749" }, "zip_invalid"],
    [{ ...BODY, serviceKey: "hipotecas" }, "invalid_service"],
    [{ ...BODY, answers: { ...BODY.answers, property: "castillo" } }, "invalid_answer_property"],
    [{ ...BODY, preferredContact: "paloma" }, "invalid_contact_method"],
    [{ ...BODY, preferredContact: "correo", email: "" }, "email_required"],
    [{ ...BODY, name: "<script>" }, "name_invalid"],
    ["{no json", "invalid_json"],
    ["x".repeat(9000), "invalid_body"],
  ];
  for (const [body, reason] of cases) {
    const fetchImpl = fakeFetch([["script.google.com", sheetOk]]);
    const res = await handleLead(request(body), { env: {}, fetchImpl, log: quiet, limiter: allowAll });
    assert.equal(res.status, 400, reason);
    assert.equal(res.jsonBody.reason, reason);
    assert.equal(fetchImpl.calls.length, 0);
  }
});

test("bloquea orígenes ajenos y limita la frecuencia por IP", async () => {
  const res = await handleLead(request(BODY, { origin: "https://evil.example" }), { env: {}, fetchImpl: fakeFetch([]), log: quiet, limiter: allowAll });
  assert.equal(res.status, 403);
  assert.ok(isAllowedOrigin("https://red-stone-0a156a910-7.centralus.7.azurestaticapps.net"));
  assert.ok(isAllowedOrigin("https://red-stone-0a156a910.7.azurestaticapps.net"));
  assert.ok(isAllowedOrigin("http://localhost:5173"));
  assert.ok(!isAllowedOrigin("https://red-stone-0a156a910.evil.net"));
  assert.ok(isAllowedOrigin("https://staging.example", ["https://staging.example"]));

  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.ok(limiter("ip", 0));
  assert.ok(limiter("ip", 10));
  assert.ok(!limiter("ip", 20));
  assert.ok(limiter("ip", 1500));
  const limited = await handleLead(request(BODY), { env: {}, fetchImpl: fakeFetch([]), log: quiet, limiter: () => false });
  assert.equal(limited.status, 429);
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9:443, 10.0.0.1" })), "203.0.113.9");
});

test("los registros de la función no contienen datos personales", async () => {
  const lines = [];
  const log = { info: (m) => lines.push(m), warn: (m) => lines.push(m), error: (m) => lines.push(m) };
  const fetchImpl = fakeFetch([["script.google.com", sheetFail]]);
  await handleLead(request(BODY), { env: {}, fetchImpl, log, limiter: allowAll });
  const all = lines.join("\n");
  assert.doesNotMatch(all, /Prueba|555|77494|facebook/);
});

test("métricas: solo eventos conocidos, sin datos personales; a tabla y/o hoja según configuración", async () => {
  const fetchImpl = fakeFetch([["table.core.windows.net", tableOk], ["script.google.com", sheetOk]]);
  const res = await handleEvent(request({ event: "chat_open", language: "en", serviceKey: "internet", name: "Ana" }), {
    env: { EVENTS_TABLE_SAS_URL: EVENTS_SAS, CHAT_EVENTS_TO_SHEET: "true" },
    fetchImpl,
    log: quiet,
    limiter: allowAll,
  });
  assert.equal(res.status, 202);
  assert.equal(res.jsonBody.stored, true);
  assert.equal(fetchImpl.calls.length, 2);
  for (const c of fetchImpl.calls) assert.doesNotMatch(JSON.stringify(c.body), /Ana/);
  const sheetCall = fetchImpl.calls.find((c) => c.url.includes("script.google.com"));
  assert.deepEqual(sheetCall.body, { type: "chat_event", event: "chat_open", language: "en", serviceKey: "internet" });

  const none = fakeFetch([]);
  const r2 = await handleEvent(request({ event: "chat_start" }), { env: { CHAT_EVENTS_TO_SHEET: "false" }, fetchImpl: none, log: quiet, limiter: allowAll });
  assert.equal(r2.status, 202);
  assert.equal(none.calls.length, 0, "con CHAT_EVENTS_TO_SHEET=false los eventos no van a la hoja");
  const sheet = fakeFetch([["script.google.com", sheetOk]]);
  await handleEvent(request({ event: "chat_open" }), { env: {}, fetchImpl: sheet, log: quiet, limiter: allowAll });
  assert.equal(sheet.calls.length, 1, "por defecto (receptor v2 instalado) los eventos van a la pestaña Chatbot");

  const bad = await handleEvent(request({ event: "drop_table" }), { env: {}, fetchImpl: none, log: quiet, limiter: allowAll });
  assert.equal(bad.status, 400);
  assert.deepEqual(validateEvent({ event: "chat_qualified", serviceKey: "x" }).event, { event: "chat_qualified", language: "es", serviceKey: "" });
});

test("health no expone secretos", () => {
  const res = handleHealth({ env: { LEADS_TABLE_SAS_URL: SAS } });
  assert.equal(res.jsonBody.sinks.leadsTable, true);
  assert.doesNotMatch(JSON.stringify(res.jsonBody), /sig=|core\.windows/);
});

test("formato de destinos: respuesta de la hoja, entidad sin fórmulas", () => {
  assert.deepEqual(interpretSheetResponse(200, '{"ok":true,"result":"success","id":"a"}'), { ok: true, id: "a" });
  assert.equal(interpretSheetResponse(200, "<html>error</html>").ok, false);
  assert.equal(interpretSheetResponse(500, "").ok, false);
  const { lead, prequalified, reasons } = validateChatLead({ ...BODY, name: "Ana", source: "=HYPERLINK()" });
  const meta = { id: "id1", receivedAt: "2026-11-23T10:00:00.000Z", prequalified, reasons };
  assert.equal(leadToTableEntity(lead, meta).Source, "'=HYPERLINK()");
  const sheet = leadToSheetBody(lead, meta);
  assert.equal(sheet.chatLeadId, "id1");
  assert.equal(sheet.consent, "sí");
});

test("resumen de métricas por día y conversión", async () => {
  const { summarize } = await import("../automation/chatbot/metrics.mjs");
  const r = summarize([
    { PartitionKey: "2026-11-23", Event: "chat_open" },
    { PartitionKey: "2026-11-23", Event: "chat_open" },
    { PartitionKey: "2026-11-23", Event: "chat_start" },
    { PartitionKey: "2026-11-24", Event: "chat_complete" },
    { PartitionKey: "2026-11-24", Event: "chat_qualified" },
    { PartitionKey: "2026-11-24", Event: "otro" },
  ]);
  assert.equal(r.totals.chat_open, 2);
  assert.equal(r.byDay["2026-11-24"].chat_complete, 1);
  assert.equal(r.conversion.startPerOpen, "50%");
  assert.equal(r.conversion.qualifiedPerComplete, "100%");
});

test("distribuidora por ZIP (Power to Choose): nombres cortos, varias, y falla sin bloquear el lead", async () => {
  const { tduShortName, tdusFromPlans, lookupTdu } = await import("../api/src/lib/tdu.js");
  assert.equal(tduShortName("ONCOR ELECTRIC DELIVERY COMPANY"), "Oncor");
  assert.equal(tduShortName("TEXAS-NEW MEXICO POWER COMPANY"), "TNMP");
  assert.equal(tduShortName("AEP TEXAS CENTRAL"), "AEP Central");
  assert.deepEqual(tdusFromPlans([{ company_tdu_name: "CENTERPOINT ENERGY HOUSTON ELECTRIC LLC" }, { company_tdu_name: "TEXAS-NEW MEXICO POWER COMPANY" }]), ["CenterPoint", "TNMP"]);
  assert.equal(await lookupTdu("12345", { fetchImpl: async () => { throw new TypeError("down"); } }), "");
  assert.equal(await lookupTdu("abc"), "");
  // Si Power to Choose falla, el lead se guarda igual (sin distribuidora).
  const fetchImpl = fakeFetch([["script.google.com", sheetOk]]);
  const res = await handleLead(request({ ...BODY, zipCode: "75201" }), { env: {}, fetchImpl, log: quiet, limiter: allowAll });
  assert.equal(res.status, 200);
  assert.doesNotMatch(fetchImpl.calls.find((c) => c.url.includes("script.google.com")).body.answers, /distribuidora/);
});

const CRM_URL = "https://kind-river-0a4356110-preview.centralus.4.azurestaticapps.net/api/ingest/lead";
const CRM_ENV = { CRM_INGEST_ENABLED: "true", CRM_INGEST_URL: CRM_URL, CRM_INGEST_SECRET: "synthetic-test-key-with-32-or-more-bytes" };
const crmOk = () => new Response(JSON.stringify({ ok: true, outcome: "created", leadId: "synthetic" }), { status: 201 });

test("copia después de Sheets, firma el cuerpo y conserva la clave en los reintentos", async () => {
  let copies = 0;
  const fetchImpl = fakeFetch([
    ["script.google.com", sheetOk],
    [CRM_URL, () => ++copies === 1 ? new Response("", { status: 503 }) : crmOk()],
  ]);
  const submittedAt = new Date("2026-11-28T15:00:00.000Z");
  const res = await handleLead(request({ ...BODY, entry: "analizador", preferredContact: "texto", contractEnd: "2027-01-07" }), {
    env: CRM_ENV, fetchImpl, log: quiet, limiter: allowAll, now: () => submittedAt,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.jsonBody.saved, ["sheet"]);
  const writes = fetchImpl.calls.filter(({ url }) => !String(url).includes("powertochoose"));
  assert.match(writes[0].url, /script\.google\.com/);
  assert.deepEqual(writes.slice(1).map(({ url }) => url), [CRM_URL, CRM_URL]);
  for (const { opts, body } of writes.slice(1)) {
    const timestamp = String(submittedAt.getTime());
    const signature = createHmac("sha256", CRM_ENV.CRM_INGEST_SECRET).update(`${timestamp}.${opts.body}`).digest("hex");
    assert.equal(opts.headers["X-V360-Timestamp"], timestamp);
    assert.equal(opts.headers["X-V360-Signature"], signature);
    assert.equal(opts.redirect, "error");
    assert.equal(body.externalKey, writes[0].body.chatLeadId);
    assert.equal(body.sourceKey, "analyzer");
    assert.equal(body.preferredContact, "sms");
    assert.equal(body.consentAt, submittedAt.toISOString());
    assert.equal(body.consentGranted, true);
    assert.deepEqual(body.bill, { billAmount: 200, monthlyKwh: 1000, centsPerKwh: 20, contractEnd: "2027-01-07", tdu: "CenterPoint" });
    assert.equal("answers" in body, false);
  }
  assert.equal(writes[1].opts.body, writes[2].opts.body);
});

test("un rechazo permanente del CRM conserva el resultado de Sheets y registra solo el ID y el estado", async () => {
  const warnings = [];
  const fetchImpl = fakeFetch([["script.google.com", sheetOk], [CRM_URL, () => new Response("", { status: 401 })]]);
  const res = await handleLead(request(BODY), { env: CRM_ENV, fetchImpl, log: { ...quiet, warn: (msg) => warnings.push(msg) }, limiter: allowAll });
  assert.equal(res.status, 200);
  assert.deepEqual(res.jsonBody.saved, ["sheet"]);
  assert.equal(fetchImpl.calls.filter(({ url }) => url === CRM_URL).length, 1);
  assert.deepEqual(warnings, [`lead ${res.jsonBody.id}: copia CRM pendiente de reconciliación (http_401)`]);
});

test("la copia queda inactiva sin habilitación, sin Sheets confirmado o con un destino ajeno", async () => {
  for (const [env, sheet] of [
    [{ ...CRM_ENV, CRM_INGEST_ENABLED: "false" }, sheetOk],
    [{ ...CRM_ENV, LEADS_TABLE_SAS_URL: SAS }, sheetFail],
    [{ ...CRM_ENV, CRM_INGEST_URL: "https://example.invalid/api/ingest/lead" }, sheetOk],
  ]) {
    const fetchImpl = fakeFetch([["script.google.com", sheet], ["table.core.windows.net", tableOk]]);
    const res = await handleLead(request(BODY), { env, fetchImpl, log: quiet, limiter: allowAll });
    assert.equal(res.status, 200);
    assert.ok(fetchImpl.calls.every(({ url }) => /script\.google\.com|table\.core\.windows\.net|powertochoose/.test(url)));
  }
});
