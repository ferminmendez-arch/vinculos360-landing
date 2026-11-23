/* Pruebas del receptor de leads (Apps Script) contra el contrato del sitio. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { interpretResponse } from "../src/lib/leads.js";

const SOURCE = fs.readFileSync(new URL("../automation/apps-script/receptor/Receptor.js", import.meta.url), "utf8");

function createEnv({ failAppend = false, lockAvailable = true, existing = null, standalone = false, props = {} } = {}) {
  const rows = existing ? existing.map((r) => [...r]) : [];
  let flushed = 0;
  const sheet = {
    getName: () => "Leads",
    getLastRow: () => rows.length,
    getRange: () => ({ setValues: (v) => { rows.splice(0, 1, ...v); } }),
    setFrozenRows: () => {},
    appendRow: (r) => {
      if (failAppend) throw new Error("Service Spreadsheets failed (simulado)");
      rows.push(r);
    },
  };
  let exists = Boolean(existing);
  const opened = [];
  const spreadsheet = {
    getSheetByName: () => (exists ? sheet : null),
    insertSheet: () => { exists = true; return sheet; },
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
    Utilities: { getUuid: () => "uuid-1" },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SOURCE, ctx);
  const post = (body) => {
    const out = ctx.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } });
    return JSON.parse(out.text);
  };
  return { ctx, rows, post, opened, flushed: () => flushed };
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
  assert.deepEqual([...env.rows[0]], ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId"]);
  const row = env.rows[1];
  assert.ok(row[0] instanceof Date);
  assert.deepEqual([...row.slice(1)], ["Prueba QA", "(281) 555-0100", "77001", "Electricidad", "facebook", "organic", "luz-texas", "efl-que-es", "", "Mobile", "uuid-1"]);
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
