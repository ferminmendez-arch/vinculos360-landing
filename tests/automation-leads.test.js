/* Pruebas de los Agentes 2 (gestión de leads) y 3 (analítica) con una hoja simulada. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createAppsScriptEnv, toSheetValues } from "../automation/apps-script/harness.mjs";

const mock = JSON.parse(fs.readFileSync(new URL("../automation/mock/leads.json", import.meta.url), "utf8"));
const PROPS = { SPREADSHEET_ID: "MOCK", OWNER_EMAIL: "owner@example.com" };

function env(options = {}) {
  return createAppsScriptEnv({
    sheets: { Leads: toSheetValues(mock.rows), ...(options.sheets || {}) },
    props: { ...PROPS, ...(options.props || {}) },
    ...options.env,
  });
}

function trackingRows(e) {
  const [head, ...rows] = e.sheet("Seguimiento").values;
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

test("lee la pestaña Leads por nombre de columna (en cualquier orden y con acentos)", () => {
  const e = env();
  const shuffled = [["Servicio", "Teléfono", "Nombre", "Código Postal", "Fecha"], ["Internet", "7130001111", "Ana", "77002", "2026-12-01T00:00:00Z"]];
  const [lead] = e.gas.v360ReadLeads(toSheetValues(shuffled));
  assert.equal(lead.name, "Ana");
  assert.equal(lead.zip, "77002");
  assert.equal(lead.service, "Internet");
});

test("falla con un mensaje claro si faltan columnas clave", () => {
  const e = env();
  assert.throws(() => e.gas.v360ReadLeads([["Fecha", "Correo"]]), /name, phone, service/);
});

test("clasifica: prueba, duplicado, área sin opción, fuera de Texas, datos inválidos y otros servicios", () => {
  const e = env();
  const leads = e.gas.v360ClassifyLeads(e.gas.v360ReadLeads(toSheetValues(mock.rows)));
  const by = (name) => leads.filter((l) => l.name === name);
  assert.equal(by("PRUEBA QA")[0].status, "Prueba");
  assert.equal(by("Lucía Ramos")[0].priority, "A");
  assert.equal(by("Lucía Ramos")[1].status, "Duplicado");
  assert.equal(by("Lucía Ramos")[1].duplicateOf, by("Lucía Ramos")[0].key);
  assert.equal(by("Carmen Ortiz")[0].classification, "Electricidad · verificar área"); // Austin
  assert.equal(by("Rosa Vega")[0].classification, "Electricidad · verificar área"); // El Paso
  assert.equal(by("Miguel Cruz")[0].classification, "Electricidad · fuera de Texas");
  assert.equal(by("Elena Ruiz")[0].classification, "Revisar datos");
  const ana = by("Ana Torres")[0]; // mismo teléfono que Pedro, otro servicio
  assert.equal(ana.status, "Nuevo");
  assert.equal(ana.priority, "B");
  assert.match(ana.reason, /ya escribió antes/);
});

test("un mismo teléfono y servicio después de 30 días NO es duplicado", () => {
  const e = env();
  const rows = [mock.rows[0],
    ["2026-10-01T00:00:00Z", "Ana", "7130001111", "77002", "Electricidad", "", "", "", "", "", ""],
    ["2026-12-01T00:00:00Z", "Ana", "7130001111", "77002", "Electricidad", "", "", "", "", "", ""]];
  const leads = e.gas.v360ClassifyLeads(e.gas.v360ReadLeads(toSheetValues(rows)));
  assert.equal(leads[1].status, "Nuevo");
});

test("processNewLeads agrega Seguimiento sin tocar Leads y es idempotente", () => {
  const e = env();
  const before = JSON.stringify(e.sheet("Leads").values);
  const first = e.gas.processNewLeads();
  assert.equal(first.added, mock.rows.length - 1);
  assert.equal(JSON.stringify(e.sheet("Leads").values), before, "Leads queda intacta");
  const second = e.gas.processNewLeads();
  assert.equal(second.added, 0);
  assert.equal(trackingRows(e).length, mock.rows.length - 1);
});

test("respeta el Estado que pone el equipo y solo agrega leads nuevos", () => {
  const e = env();
  e.gas.processNewLeads();
  const sheet = e.sheet("Seguimiento");
  const col = sheet.values[0].indexOf("Estado");
  sheet.values[2][col] = "Calificado";
  e.sheet("Leads").values.push([new Date("2026-12-06T10:00:00Z"), "Nuevo Lead", "2810001234", "77005", "Electricidad", "facebook", "organic", "luz-texas", "tipo-de-plan", "", "Mobile"]);
  const res = e.gas.processNewLeads();
  assert.equal(res.added, 1);
  assert.equal(sheet.values[2][col], "Calificado");
  assert.equal(res.metrics.qualified, 1);
});

test("borrador de WhatsApp: solo para leads accionables, con opción de no recibir mensajes y sin enviar nada", () => {
  const e = env();
  e.gas.processNewLeads();
  const rows = trackingRows(e);
  const lucia = rows.find((r) => r.Nombre === "Lucía Ramos" && r.Estado === "Nuevo");
  assert.match(lucia["Borrador WhatsApp"], /Hola Lucía/);
  assert.match(lucia["Borrador WhatsApp"], /"NO"/);
  assert.match(lucia["Abrir WhatsApp"], /^https:\/\/wa\.me\/17130001001\?text=/);
  const dup = rows.find((r) => r.Estado === "Duplicado");
  assert.equal(dup["Borrador WhatsApp"], "");
  const invalid = rows.find((r) => r.Nombre === "Elena Ruiz");
  assert.equal(invalid["Abrir WhatsApp"], "");
  // Los únicos correos van al dueño.
  assert.ok(e.emails.every((m) => m.to === "owner@example.com"));
});

test("neutraliza fórmulas escritas en el formulario (inyección en hojas de cálculo)", () => {
  const e = env();
  e.gas.processNewLeads();
  const row = trackingRows(e).find((r) => String(r.Nombre).includes("HYPERLINK"));
  assert.ok(row.Nombre.startsWith("'="));
});

test("el aviso de leads nuevos no incluye datos personales salvo que se active ALERT_DETAILS", () => {
  const e = env();
  e.gas.processNewLeads();
  assert.equal(e.emails.length, 1);
  assert.ok(!e.emails[0].htmlBody.includes("Lucía"));
  assert.ok(!e.emails[0].htmlBody.includes("7130001001"));
  const e2 = env({ props: { ALERT_DETAILS: "true" } });
  e2.gas.processNewLeads();
  assert.ok(e2.emails[0].htmlBody.includes("Lucía"));
  assert.ok(!e2.emails[0].htmlBody.includes("7130001001"), "nunca incluye el teléfono");
});

test("métricas: solo datos observados; sin gasto no hay costo por lead", () => {
  const e = env();
  const res = e.gas.processNewLeads();
  const m = res.metrics;
  assert.equal(m.leadsValid, 10);
  assert.equal(m.excludedTests, 1);
  assert.equal(m.excludedDuplicates, 1);
  assert.equal(m.spend, null);
  assert.equal(m.costPerLead, null);
  assert.equal(m.websiteVisits, null);
  const panel = e.sheet("Panel").values.map((r) => r.join(" | ")).join("\n");
  assert.match(panel, /Costo por lead \| sin datos/);
  assert.match(panel, /No disponible: no hay analítica web instalada/);
});

test("métricas con gasto registrado y periodo de la meta", () => {
  const e = env({ sheets: { Gastos: toSheetValues(mock.spend) }, props: { GOAL_START: "2026-11-30" } });
  const m = e.gas.processNewLeads().metrics;
  assert.equal(m.leadsValid, 10);
  assert.equal(m.spend, 27.5);
  assert.equal(m.costPerLead, 2.75);
  assert.equal(m.costPerQualified, null, "sin calificados no hay costo por calificado");
  assert.equal(m.byContent[0].key, "luz-texas · efl-que-es");
});

test("alerta de presupuesto al 80 % y al tope, una sola vez por nivel", () => {
  const spend80 = [mock.spend[0], ["2026-12-03T12:00:00Z", "Facebook", "x", 41, ""]];
  const e = env({ sheets: { Gastos: toSheetValues(spend80) } });
  e.gas.processNewLeads();
  e.gas.processNewLeads();
  const budgetMails = () => e.emails.filter((m) => /tope|80 %/.test(m.subject));
  assert.equal(budgetMails().length, 1);
  assert.match(budgetMails()[0].subject, /80 %/);
  e.sheet("Gastos").values.push([new Date("2026-12-04T12:00:00Z"), "Facebook", "x", 10, ""]);
  e.gas.processNewLeads();
  assert.equal(budgetMails().length, 2);
  assert.match(budgetMails()[1].subject, /tope/);
});

test("reintenta fallas temporales de Google Sheets y termina bien", () => {
  const e = env({ env: { openFailures: 2 } });
  e.sheet("Leads").failGetValues = 1;
  const res = e.gas.processNewLeads();
  assert.equal(res.added, mock.rows.length - 1);
  assert.ok(e.sleeps.length >= 3, "esperó antes de reintentar");
});

test("si falla, registra el error y avisa al dueño (máximo una vez cada 6 horas)", () => {
  const e = env();
  e.sheet("Seguimiento") || e.gas.processNewLeads(); // crea pestañas
  const leadsSheet = e.sheet("Leads");
  leadsSheet.failGetValues = 99;
  assert.throws(() => e.gas.processNewLeads());
  assert.throws(() => e.gas.processNewLeads());
  const alerts = e.emails.filter((m) => /falló/.test(m.subject));
  assert.equal(alerts.length, 1);
  const log = e.sheet("Registro").values.map((r) => r[1]);
  assert.ok(log.filter((l) => l === "error").length >= 2);
});

test("si la hoja no existe o falta SPREADSHEET_ID, avisa y no inventa nada", () => {
  const e = env({ env: { missingSpreadsheet: true } });
  assert.throws(() => e.gas.processNewLeads(), /No se encontró/);
  assert.equal(e.emails.filter((m) => /falló/.test(m.subject)).length, 1);
  const e2 = env({ props: { SPREADSHEET_ID: "" } });
  assert.throws(() => e2.gas.processNewLeads(), /SPREADSHEET_ID/);
});

test("si otra ejecución está en curso, se omite sin tocar nada", () => {
  const e = env({ env: { lockAvailable: false } });
  assert.deepEqual({ ...e.gas.processNewLeads() }, { skipped: true });
  assert.equal(e.sheet("Seguimiento"), undefined);
});

test("setup crea pestañas y activadores sin duplicarlos", () => {
  const e = env();
  e.gas.setup();
  e.gas.setup();
  assert.equal(e.triggers.length, 2);
  assert.deepEqual(e.triggers.map((t) => t.getHandlerFunction()).sort(), ["processNewLeads", "sendWeeklyReport"]);
  for (const name of ["Panel", "Semanal", "Gastos", "Seguimiento", "Registro"]) assert.ok(e.sheet(name), name);
});

test("reporte semanal: guarda historial y envía correo con recomendaciones basadas en datos", () => {
  const e = env({ props: { GOAL_START: "2026-11-30" } });
  e.gas.processNewLeads();
  e.gas.sendWeeklyReport();
  assert.equal(e.sheet("Semanal").values.length, 2);
  const mail = e.emails.find((m) => /Reporte semanal/.test(m.subject));
  assert.match(mail.subject, /0\/10 calificados/);
  assert.match(mail.htmlBody, /sin contactar por más de 24 horas|ninguno marcado como Calificado/);
  assert.ok(!mail.htmlBody.includes("7130001001"), "el reporte no lleva teléfonos");
});

test("runSelfTest funciona sin hoja ni correo", () => {
  const e = createAppsScriptEnv({ props: {} });
  const res = e.gas.runSelfTest();
  assert.equal(res.leadsValid, 3);
  assert.equal(e.emails.length, 0);
});

test("estados de inscripción: cuentan como calificados e 'Inscrito' suma a inscritos", () => {
  const e = env();
  e.gas.processNewLeads();
  const sheet = e.sheet("Seguimiento");
  const col = sheet.values[0].indexOf("Estado");
  const name = sheet.values[0].indexOf("Nombre");
  sheet.values.forEach((r, i) => {
    if (i && r[name] === "Pedro Salas") r[col] = "Inscrito";
    if (i && r[name] === "Jorge Méndez") r[col] = "Inscripción en proceso";
  });
  const m = e.gas.processNewLeads().metrics;
  assert.equal(m.qualified, 2);
  assert.equal(m.enrolled, 1);
  assert.match(e.sheet("Panel").values.map((r) => r.join(" | ")).join("\n"), /Inscritos \(clientes dados de alta\) \| 1/);
});
