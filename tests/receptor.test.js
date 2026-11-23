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

function createEnv({ failAppend = false, lockAvailable = true, existing = null, standalone = false, props = {}, today = "2026-11-23" } = {}) {
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
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SOURCE, ctx);
  const post = (body) => {
    const out = ctx.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } });
    return JSON.parse(out.text);
  };
  return { ctx, rows, metricRows, post, opened, flushed: () => flushed };
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

test("v2: agrega las columnas del chatbot a una hoja v1 existente sin mover las originales", () => {
  const env = createEnv({ existing: [V1_HEADERS, [new Date(), "Ana", "(281) 555-0101"]] });
  const res = env.post(CHAT_BODY);
  assert.equal(res.ok, true);
  assert.deepEqual([...env.rows[0].slice(0, 12)], V1_HEADERS);
  assert.deepEqual([...env.rows[0].slice(12)], ["Channel", "Language", "Email", "PreferredContact", "Consent", "ConsentVersion", "ConsentAt", "Qualification", "Answers", "ChatLeadId"]);
  const row = env.rows[2];
  assert.equal(row[11], "uuid-1");
  assert.deepEqual([...row.slice(12)], ["chatbot", "en", "qa@example.com", "correo", "sí", "2026-11-v1", "2026-11-23T10:00:00.000Z", "Precalificado", "property=casa; decision=si", "chat-1"]);
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
  assert.deepEqual([...env.metricRows[0]], ["Fecha", "chat_open", "chat_start", "chat_complete", "chat_qualified"]);
  assert.equal(env.metricRows.length, 2);
  assert.deepEqual([...env.metricRows[1]], ["'2026-11-23", 2, 0, 1, 0]);
  assert.equal(env.rows.length, 0, "un evento nunca escribe en Leads");
});
