/* Pruebas del receptor de leads (Apps Script) contra el contrato del sitio. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { interpretResponse } from "../src/lib/leads.js";

const SOURCE = fs.readFileSync(new URL("../automation/apps-script/receptor/Receptor.js", import.meta.url), "utf8");

function makeSheet(name, rows, { failAppend = false } = {}) {
  return {
    getName: () => name,
    getLastRow: () => rows.length,
    getLastColumn: () => rows.reduce((m, r) => Math.max(m, r.length), 0),
    getRange: (row, col, nRows, nCols) => ({
      getValues: () =>
        Array.from({ length: nRows }, (_, i) =>
          Array.from({ length: nCols }, (_, j) => (rows[row - 1 + i] || [])[col - 1 + j] ?? "")
        ),
      setValues: (v) => {
        v.forEach((vals, i) => {
          const r = rows[row - 1 + i] || (rows[row - 1 + i] = []);
          vals.forEach((val, j) => { r[col - 1 + j] = val; });
        });
      },
    }),
    setFrozenRows: () => {},
    appendRow: (r) => {
      if (failAppend) throw new Error("Service Spreadsheets failed (simulado)");
      rows.push(r);
    },
  };
}

function createEnv({ failAppend = false, lockAvailable = true, existing = null, standalone = false, props = {}, today = "2026-11-23", failMail = false, graph = null } = {}) {
  const mails = [];
  const fetches = [];
  const cache = {};
  const rows = existing ? existing.map((r) => [...r]) : [];
  const metricRows = [];
  let flushed = 0;
  const sheets = {};
  const leadsSheet = makeSheet("Leads", rows, { failAppend });
  const metricsSheet = makeSheet("Chatbot", metricRows);
  if (existing) sheets.Leads = leadsSheet;
  const opened = [];
  const spreadsheet = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = n === "Chatbot" ? metricsSheet : leadsSheet),
  };
  const sandbox = {
    Date,
    console: { error() {}, log() {} },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (standalone ? null : spreadsheet),
      openById: (id) => { opened.push(id); return spreadsheet; },
      flush: () => { flushed += 1; },
    },
    LockService: { getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock: () => {} }) },
    Utilities: { getUuid: () => "uuid-1", formatDate: () => today },
    MailApp: {
      sendEmail: (m) => { if (failMail) throw new Error("Service invoked too many times (simulado)"); mails.push(m); },
      getRemainingDailyQuota: () => 100,
    },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    JSON,
    UrlFetchApp: {
      fetch: (url, opts) => {
        fetches.push({ url, opts });
        const r = graph ? graph(url, opts) : { code: 500, body: "" };
        return { getResponseCode: () => r.code, getContentText: () => r.body };
      },
    },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SOURCE, ctx);
  const post = (body) => {
    const out = ctx.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } });
    return JSON.parse(out.text);
  };
  return { ctx, rows, metricRows, post, opened, mails, fetches, flushed: () => flushed };
}

/* El mismo payload que arma src/components/ContactSection.jsx. */
const PAYLOAD = {
  name: "Prueba QA",
  phone: "(281) 555-0100",
  zipCode: "77001",
  service: "Electricidad",
  source: "facebook",
  medium: "organic",
  campaign: "luz-texas",
  ad: "efl-que-es",
  fbclid: "",
  device: "Mobile",
};

test("guarda el lead con encabezados compatibles con el agente y confirma después de escribir", () => {
  const env = createEnv();
  const res = env.post(PAYLOAD);
  assert.deepEqual({ ...res }, { ok: true, result: "success", id: "uuid-1" });
  assert.deepEqual([...env.rows[0].slice(0, 12)], ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId"]);
  const row = env.rows[1];
  assert.ok(row[0] instanceof Date);
  assert.deepEqual([...row.slice(1, 12)], ["Prueba QA", "(281) 555-0100", "77001", "Electricidad", "facebook", "organic", "luz-texas", "efl-que-es", "", "Mobile", "uuid-1"]);
  // v2: las columnas del chatbot van a la derecha; el formulario queda como "formulario".
  assert.equal(env.rows[0][12], "Channel");
  assert.equal(row[12], "formulario");
  assert.equal(env.flushed(), 1);
});

test("el sitio interpreta la respuesta de éxito como confirmada y la de error como rechazada", () => {
  const ok = createEnv().post(PAYLOAD);
  assert.equal(interpretResponse(200, JSON.stringify(ok)).status, "confirmed");
  const bad = createEnv().post({ ...PAYLOAD, phone: "123" });
  assert.equal(interpretResponse(200, JSON.stringify(bad)).status, "rejected");
});

test("rechaza datos inválidos sin escribir nada", () => {
  const cases = [
    [{ ...PAYLOAD, name: "A" }, "invalid_name"],
    [{ ...PAYLOAD, phone: "555" }, "invalid_phone"],
    [{ ...PAYLOAD, zipCode: "7700" }, "invalid_zip"],
    [{ ...PAYLOAD, service: "Hipotecas" }, "invalid_service"],
    ["no es json", "invalid_json"],
    ["x".repeat(6000), "invalid_body"],
  ];
  for (const [body, reason] of cases) {
    const env = createEnv();
    const res = env.post(body);
    assert.equal(res.ok, false, reason);
    assert.equal(res.reason, reason);
    assert.equal(env.rows.length, 0);
  }
});

test("si falla la hoja o está ocupada, NO confirma (el sitio no abre WhatsApp como guardado)", () => {
  const failing = createEnv({ failAppend: true }).post(PAYLOAD);
  assert.equal(failing.ok, false);
  assert.equal(interpretResponse(200, JSON.stringify(failing)).status, "rejected");
  const busy = createEnv({ lockAvailable: false }).post(PAYLOAD);
  assert.equal(busy.reason, "busy");
});

test("neutraliza fórmulas y normaliza el teléfono", () => {
  const env = createEnv();
  env.post({ ...PAYLOAD, name: "=HYPERLINK(\"x\")", phone: "+1 281 555 0100", source: "@evil" });
  const row = env.rows[1];
  assert.equal(row[1], "'=HYPERLINK(\"x\")");
  assert.equal(row[2], "(281) 555-0100");
  assert.equal(row[5], "'@evil");
});

test("no reescribe encabezados si la pestaña ya tiene datos", () => {
  const env = createEnv({ existing: [["Timestamp", "Name"], ["x", "y"]] });
  env.post(PAYLOAD);
  assert.equal(env.rows.length, 3);
  assert.deepEqual(env.rows[0], ["Timestamp", "Name"]);
});

test("doGet responde sin datos", () => {
  const env = createEnv();
  assert.deepEqual({ ...JSON.parse(env.ctx.doGet().text) }, { ok: true, service: "vinculos360-leads" });
});

test("proyecto independiente: usa SPREADSHEET_ID y, si falta, no confirma", () => {
  const env = createEnv({ standalone: true, props: { SPREADSHEET_ID: "abc123" } });
  assert.equal(env.post(PAYLOAD).ok, true);
  assert.deepEqual([...env.opened], ["abc123"]);
  const missing = createEnv({ standalone: true }).post(PAYLOAD);
  assert.equal(missing.ok, false);
});

/* ---------- v2: chatbot ---------- */

const V1_HEADERS = ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId"];

const CHAT_BODY = {
  ...PAYLOAD,
  device: "Mobile · Chatbot",
  channel: "chatbot",
  language: "en",
  email: "qa@example.com",
  preferredContact: "correo",
  consent: "sí",
  consentVersion: "2026-11-v1",
  consentAt: "2026-11-23T10:00:00.000Z",
  qualification: "Precalificado",
  answers: "property=casa; decision=si",
  chatLeadId: "chat-1",
};

const V3_EXTRA = ["Channel", "Language", "Email", "PreferredContact", "Consent", "ConsentVersion", "ConsentAt", "Qualification", "Answers", "ChatLeadId"];
const V4_EXTRA = ["BillAmount", "MonthlyKwh", "EffectiveCentsKwh", "ContractExpiration", "LeadSource"];
const V2_METRICS = ["Fecha", "chat_open", "chat_start", "chat_complete", "chat_qualified"];
const V4_METRICS = ["analyzer_view", "analyzer_calc", "analyzer_cta", "analyzer_share", "reminder_signup"];

test("v2: agrega las columnas del chatbot a una hoja v1 existente sin mover las originales", () => {
  const env = createEnv({ existing: [V1_HEADERS, [new Date(), "Ana", "(281) 555-0101"]] });
  const res = env.post(CHAT_BODY);
  assert.equal(res.ok, true);
  assert.deepEqual([...env.rows[0].slice(0, 12)], V1_HEADERS);
  assert.deepEqual([...env.rows[0].slice(12)], [...V3_EXTRA, ...V4_EXTRA]);
  const row = env.rows[2];
  assert.equal(row[11], "uuid-1");
  assert.deepEqual([...row.slice(12)], ["chatbot", "en", "qa@example.com", "correo", "sí", "2026-11-v1", "2026-11-23T10:00:00.000Z", "Precalificado", "property=casa; decision=si", "chat-1", "", "", "", "", ""]);
});

test("v2: una pestaña con otro formato de encabezados no se modifica y guarda solo las 12 columnas", () => {
  const env = createEnv({ existing: [["Timestamp", "Name"], ["x", "y"]] });
  env.post(CHAT_BODY);
  assert.deepEqual(env.rows[0], ["Timestamp", "Name"]);
  assert.equal(env.rows[2].length, 12);
});

test("v2: el cuerpo del chatbot sin claves extra funciona igual que v1", () => {
  const env = createEnv();
  assert.equal(env.post({ ...PAYLOAD, device: "Desktop · Chatbot" }).ok, true);
});

test("v2: métricas del chatbot por día, sin datos personales", () => {
  const env = createEnv();
  assert.equal(env.post({ type: "chat_event", event: "chat_open" }).ok, true);
  assert.equal(env.post({ type: "chat_event", event: "chat_open" }).ok, true);
  assert.equal(env.post({ type: "chat_event", event: "chat_complete" }).ok, true);
  assert.equal(env.post({ type: "chat_event", event: "borrar_todo" }).ok, false);
  assert.deepEqual([...env.metricRows[0]], [...V2_METRICS, ...V4_METRICS]);
  assert.equal(env.metricRows.length, 2);
  assert.deepEqual([...env.metricRows[1]], ["'2026-11-23", 2, 0, 1, 0, 0, 0, 0, 0, 0]);
  assert.equal(env.rows.length, 0, "un evento nunca escribe en Leads");
});

test("v3: acepta los servicios nuevos (TV, celular, identidad, pagos)", () => {
  for (const service of ["Televisión", "Telefonía celular", "Protección de identidad", "Procesamiento de pagos"]) {
    const env = createEnv();
    assert.equal(env.post({ ...PAYLOAD, service }).ok, true, service);
  }
  assert.equal(createEnv().post({ ...PAYLOAD, service: "Hipotecas" }).ok, false);
});

test("v4: actualiza una hoja v3 en producción sin mover columnas y guarda los datos del analizador", () => {
  const env = createEnv({ existing: [[...V1_HEADERS, ...V3_EXTRA], [new Date(), "Ana", "(281) 555-0101"]] });
  const res = env.post({
    ...CHAT_BODY,
    channel: "analizador",
    billAmount: "200",
    monthlyKwh: "1000",
    effectiveCentsKwh: "20",
    contractExpiration: "2027-01-15",
    leadSource: "Energy Bill Analyzer",
  });
  assert.equal(res.ok, true);
  assert.deepEqual([...env.rows[0]], [...V1_HEADERS, ...V3_EXTRA, ...V4_EXTRA]);
  const row = env.rows[2];
  assert.equal(row[12], "analizador");
  assert.deepEqual([...row.slice(22)], ["200", "1000", "20", "2027-01-15", "Energy Bill Analyzer"]);
});

test("v4: una hoja con columnas propias a la derecha no se toca (guarda solo las 12 originales)", () => {
  const env = createEnv({ existing: [[...V1_HEADERS, ...V3_EXTRA, "MiNota"], ["x"]] });
  assert.equal(env.post(CHAT_BODY).ok, true);
  assert.equal(env.rows[0][22], "MiNota");
  assert.equal(env.rows[2].length, 12);
});

test("v4: la pestaña Chatbot v2 gana los contadores del analizador sin perder los días anteriores", () => {
  const env = createEnv();
  env.metricRows.push([...V2_METRICS], ["'2026-11-22", 5, 3, 1, 1]);
  env.ctx.receptorMetricsSheet(); // crea la referencia a la pestaña existente
  assert.equal(env.post({ type: "chat_event", event: "analyzer_calc" }).ok, true);
  assert.equal(env.post({ type: "chat_event", event: "analyzer_cta" }).ok, true);
  assert.deepEqual([...env.metricRows[0]], [...V2_METRICS, ...V4_METRICS]);
  assert.deepEqual([...env.metricRows[1]], ["'2026-11-22", 5, 3, 1, 1]);
  assert.deepEqual([...env.metricRows[2]], ["'2026-11-23", 0, 0, 0, 0, 0, 1, 1, 0, 0]);
});


/* ---------- v5: correo de confirmación al cliente ---------- */
const EMAIL_BODY = { ...PAYLOAD, name: "Fermin Prueba", channel: "analizador", language: "es", email: "cliente@example.com", preferredContact: "correo", consent: "sí", consentVersion: "2026-11-v1" };

test("v5: con correo y consentimiento, envía UNA confirmación después de guardar", () => {
  const env = createEnv();
  assert.equal(env.post(EMAIL_BODY).ok, true);
  assert.equal(env.rows.length, 2, "la fila se guardó");
  assert.equal(env.mails.length, 1);
  const m = env.mails[0];
  assert.equal(m.to, "cliente@example.com");
  assert.equal(m.replyTo, "fermin.mendez@vinculos360.com", "las respuestas llegan al correo del negocio");
  assert.equal(m.name, "Fermín Mendez · Vínculos 360");
  assert.match(m.body, /fermin\.mendez@vinculos360\.com/);
  assert.equal(m.subject, "Recibimos tu solicitud — Vínculos 360");
  assert.match(m.body, /Hola Fermin,/);
  assert.match(m.body, /energía eléctrica \(ZIP 77001\)/);
  assert.match(m.body, /por correo/);
  assert.match(m.body, /nunca te pediremos tu número de Seguro Social/);
  assert.match(m.body, /responde a este correo con "NO"/);
  assert.doesNotMatch(m.body + m.htmlBody, /xoom|acn|vivint|gratis|ahorr|cr[eé]dito|\$\d/i);
  assert.equal(env.post(EMAIL_BODY).ok, true);
  assert.equal(env.mails.length, 1, "no repite al mismo correo en 6 h");
});

test("v5: inglés y recordatorio de vencimiento", () => {
  const env = createEnv();
  env.post({ ...EMAIL_BODY, language: "en", preferredContact: "whatsapp" });
  assert.equal(env.mails[0].subject, "We received your request — Vínculos 360");
  assert.match(env.mails[0].body, /about electricity \(ZIP 77001\).*by WhatsApp/s);
  const env2 = createEnv();
  env2.post({ ...EMAIL_BODY, channel: "recordatorio", contractExpiration: "2027-03-15", consentVersion: "2026-11-r1" });
  assert.equal(env2.mails[0].subject, "Tu recordatorio quedó listo — Vínculos 360");
  assert.match(env2.mails[0].body, /el 15 de marzo de 2027/);
});

test("v5: sin correo, correo inválido o sin consentimiento no envía nada", () => {
  for (const body of [PAYLOAD, { ...EMAIL_BODY, email: "no-es-correo" }, { ...EMAIL_BODY, consent: "" }]) {
    const env = createEnv();
    assert.equal(env.post(body).ok, true);
    assert.equal(env.mails.length, 0);
  }
});

test("v5: si el correo falla, el lead se confirma igual", () => {
  const env = createEnv({ failMail: true });
  const res = env.post(EMAIL_BODY);
  assert.equal(res.ok, true);
  assert.equal(env.rows.length, 2);
});

test("v5: se apaga con CONFIRMATION_EMAIL_ENABLED=false y no se envía si falla el guardado", () => {
  const off = createEnv({ props: { CONFIRMATION_EMAIL_ENABLED: "false" } });
  off.post(EMAIL_BODY);
  assert.equal(off.mails.length, 0);
  const broken = createEnv({ failAppend: true });
  assert.equal(broken.post(EMAIL_BODY).ok, false);
  assert.equal(broken.mails.length, 0);
});

test("v5: el HTML escapa el nombre (sin inyección)", () => {
  const env = createEnv();
  env.post({ ...EMAIL_BODY, name: "Ana <b>x</b>" });
  assert.doesNotMatch(env.mails[0].htmlBody, /<b>x<\/b>/);
});


/* ---------- v5: envío desde el dominio (Microsoft Graph) ---------- */
const MS = { MS_TENANT_ID: "tenant-x", MS_CLIENT_ID: "client-x", MS_CLIENT_SECRET: "secreto-x", MS_SENDER: "fermin.mendez@vinculos360.com" };
const graphOk = (url) => (/oauth2/.test(url) ? { code: 200, body: JSON.stringify({ access_token: "tok", expires_in: 3599 }) } : { code: 202, body: "" });

test("dominio: con las propiedades MS_* el correo sale del buzón de vinculos360.com por Graph", () => {
  const env = createEnv({ props: MS, graph: graphOk });
  assert.equal(env.post(EMAIL_BODY).ok, true);
  assert.equal(env.mails.length, 0, "no usa la cuenta de Google");
  const send = env.fetches.find((f) => /sendMail/.test(f.url));
  assert.equal(send.url, "https://graph.microsoft.com/v1.0/users/fermin.mendez%40vinculos360.com/sendMail");
  assert.equal(send.opts.headers.Authorization, "Bearer tok");
  const body = JSON.parse(send.opts.payload);
  assert.equal(body.message.toRecipients[0].emailAddress.address, "cliente@example.com");
  assert.equal(body.message.subject, "Recibimos tu solicitud — Vínculos 360");
  assert.equal(body.saveToSentItems, true);
  const token = env.fetches.find((f) => /oauth2/.test(f.url));
  assert.equal(token.opts.payload.grant_type, "client_credentials");
  assert.ok(!JSON.stringify(body).includes("secreto-x"), "el secreto nunca va en el mensaje");
});

test("dominio: si Graph falla, envía por la cuenta de Google y el lead se confirma igual", () => {
  const env = createEnv({ props: MS, graph: (url) => (/oauth2/.test(url) ? { code: 401, body: "" } : { code: 202, body: "" }) });
  assert.equal(env.post(EMAIL_BODY).ok, true);
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].replyTo, "fermin.mendez@vinculos360.com");
});

test("dominio: sin configuración completa no llama a Microsoft", () => {
  const env = createEnv({ props: { MS_TENANT_ID: "t" }, graph: graphOk });
  env.post(EMAIL_BODY);
  assert.equal(env.fetches.length, 0);
  assert.equal(env.mails.length, 1);
});
