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

/* ---------- Comparación con la pestaña Tarifas y paso de inscripción (nov. 2026) ---------- */

const V2_HEAD = ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId",
  "Channel", "Language", "Email", "PreferredContact", "Consent", "ConsentVersion", "ConsentAt", "Qualification", "Answers", "ChatLeadId"];
const TARIFAS = [
  ["Distribuidora", "Plan", "Plazo (meses)", "¢/kWh a 500", "¢/kWh a 1000", "¢/kWh a 2000", "Actualizado", "Notas"],
  ["CenterPoint", "SureLock 12", 12, 19.8, 17.6, 16.4, "2026-11-26", ""],
  ["CenterPoint", "SureLock 18", 18, 0.192, 0.171, 0.162, "2026-11-26", "en dólares también se acepta"],
  ["Oncor", "SureLock 18", 18, "", "", 16.9, "2026-11-26", ""],
];
function chatRow(name, phone, zip, answers) {
  return ["2026-12-01T15:00:00Z", name, phone, zip, "Electricidad", "Direct", "", "", "", "", "Mobile · Chatbot · Ahorro: alta", "id",
    "chatbot", "es", "", "whatsapp", "sí", "2026-11-v1", "", "Precalificado", answers, "c1"];
}

test("lee Tarifas (centavos o dólares) e interpola el precio al consumo del cliente", () => {
  const e = env();
  const tariffs = e.gas.v360ReadTariffs(TARIFAS);
  assert.equal(tariffs.length, 3);
  assert.equal(tariffs[1].p1000, 17.1);
  assert.equal(e.gas.v360PlanPriceAt(tariffs[0], 1000), 17.6);
  assert.equal(e.gas.v360PlanPriceAt(tariffs[0], 1500), 17);
  assert.equal(e.gas.v360PlanPriceAt(tariffs[0], 300), 19.8);
  assert.equal(e.gas.v360PlanPriceAt(tariffs[2], 1000), 16.9, "si solo hay precio a 2,000 kWh, usa ese");
});

test("sugiere el plan más barato de la distribuidora y estima la diferencia mensual", () => {
  const e = env();
  const tariffs = e.gas.v360ReadTariffs(TARIFAS);
  const lead = { service: "Electricidad", answers: e.gas.v360ParseAnswers("bill=200; kwh=1000; distribuidora=CenterPoint") };
  const s = e.gas.v360SuggestPlan(lead, tariffs);
  assert.equal(s.tdu, "CenterPoint");
  assert.equal(s.currentCents, 20);
  assert.equal(s.planName, "SureLock 18 (18 meses)");
  assert.equal(s.planCents, 17.1);
  assert.equal(s.monthlyDiff, 29);
  assert.match(e.gas.v360SuggestionLine(s), /paga 20¢\/kWh · SureLock 18 \(18 meses\) a 17.1¢ · ahorro estimado ~\$29\/mes/);
  // Sin datos suficientes no inventa nada.
  assert.equal(e.gas.v360SuggestPlan({ service: "Electricidad", answers: e.gas.v360ParseAnswers("bill=nose; distribuidora=Oncor") }, tariffs).planName, undefined);
  assert.equal(e.gas.v360SuggestPlan({ service: "Electricidad", answers: e.gas.v360ParseAnswers("bill=200; kwh=1000; distribuidora=CenterPoint o TNMP") }, tariffs).planName, undefined, "ZIP con dos distribuidoras: verificar a mano");
  assert.deepEqual({ ...e.gas.v360SuggestPlan({ service: "Internet", answers: {} }, tariffs) }, {});
});

test("Seguimiento: agrega las columnas nuevas a una pestaña existente, compara y prepara el mensaje de inscripción", () => {
  const oldHead = [...e0().gas.V360.TRACKING_HEADERS.slice(0, 20)];
  const e = env({
    sheets: {
      Leads: toSheetValues([V2_HEAD, chatRow("Laura Gómez", "7134440123", "77494", "property=casa; decision=si; bill=200; kwh=1000; contract=sincontrato; distribuidora=CenterPoint")]),
      Seguimiento: [oldHead],
      Tarifas: TARIFAS,
    },
  });
  e.gas.processNewLeads();
  const [head] = e.sheet("Seguimiento").values;
  assert.deepEqual([...head.slice(0, 20)], oldHead, "no mueve las columnas existentes");
  const [row] = trackingRows(e);
  assert.equal(row["Distribuidora"], "CenterPoint");
  assert.equal(row["Precio actual (¢/kWh)"], 20);
  assert.equal(row["Plan sugerido"], "SureLock 18 (18 meses)");
  assert.equal(row["Diferencia estimada ($/mes)"], 29);
  assert.match(row["Mensaje inscripción"], /acn\.xoomenergy\.com\/en\/\?p=04893385/);
  assert.match(row["Mensaje inscripción"], /nosotros no los vemos ni los guardamos/);
  assert.match(row["Abrir WhatsApp (inscripción)"], /^https:\/\/wa\.me\/17134440123\?text=/);
  // El correo trae la comparación, sin nombre ni teléfono.
  const body = e.emails[0].htmlBody;
  assert.match(body, /ahorro estimado ~\$29\/mes/);
  assert.doesNotMatch(body, /Laura|7134440123/);
});

test("el mensaje de inscripción usa la propiedad ENROLL_URL_ELECTRICIDAD y no se prepara para otros servicios", () => {
  const e = env({
    props: { ENROLL_URL_ELECTRICIDAD: "https://ejemplo.test/inscribir" },
    sheets: { Leads: toSheetValues([V2_HEAD, chatRow("Laura Gómez", "7134440123", "77494", "bill=nose")]) },
  });
  e.gas.processNewLeads();
  assert.match(trackingRows(e)[0]["Mensaje inscripción"], /ejemplo\.test\/inscribir/);
  const e2 = env({ sheets: { Leads: toSheetValues([V2_HEAD, [...chatRow("Luis Pérez", "7134440124", "77494", "").slice(0, 4), "Internet", ...chatRow("x", "1", "1", "").slice(5)]]) } });
  e2.gas.processNewLeads();
  assert.equal(trackingRows(e2)[0]["Mensaje inscripción"], "");
});

function e0() {
  return env();
}

/* ---------- Analizador de factura (nov. 2026): canal y embudo en el Panel ---------- */

test("canal del lead: Energy Bill Analyzer, Chatbot o Formulario", () => {
  const e = env();
  const values = [
    ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Channel", "LeadSource"],
    ["2026-12-01T10:00:00Z", "Prueba A", "2815550101", "77036", "Electricidad", "analizador", "Energy Bill Analyzer"],
    ["2026-12-01T11:00:00Z", "Prueba B", "2815550102", "77036", "Electricidad", "chatbot", ""],
    ["2026-12-01T12:00:00Z", "Prueba C", "2815550103", "77036", "Internet", "formulario", ""],
  ];
  const leads = e.gas.v360ReadLeads(toSheetValues(values));
  assert.deepEqual([...leads.map((l) => l.channel)], ["Energy Bill Analyzer", "Chatbot", "Formulario"]);
});

test("embudo: suma los contadores de la pestaña Chatbot dentro del periodo de la meta", () => {
  const e = env();
  const values = [
    ["Fecha", "chat_open", "chat_start", "chat_complete", "chat_qualified", "analyzer_view", "analyzer_calc", "analyzer_cta"],
    ["'2026-11-29", 9, 9, 9, 9, 9, 9, 9],
    ["'2026-11-30", 4, 3, 2, 1, 10, 6, 2],
    ["'2026-12-01", 1, 1, 0, 0, 5, 2, 1],
  ];
  const f = e.gas.v360ReadFunnel(values, new Date("2026-11-30T00:00:00"), new Date("2026-12-30T00:00:00"));
  assert.equal(f.analyzer_view, 15);
  assert.equal(f.analyzer_calc, 8);
  assert.equal(f.analyzer_cta, 3);
  assert.equal(f.chat_complete, 2);
  // Una pestaña v2 (sin columnas del analizador) da ceros, no error.
  const old = e.gas.v360ReadFunnel([values[0].slice(0, 5), ["'2026-12-01", 1, 1, 1, 0]], null, null);
  assert.equal(old.analyzer_view, 0);
  assert.equal(old.chat_open, 1);
});

test("Panel: muestra leads por canal y el embudo del analizador", () => {
  const e = env();
  const leads = e.gas.v360ClassifyLeads(
    e.gas.v360ReadLeads(
      toSheetValues([
        ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Channel", "LeadSource"],
        // Datos sintéticos que no parecen prueba (si no, el agente los excluye del conteo).
        ["2026-12-01T10:00:00Z", "Lucía Ficticia", "7130009999", "77036", "Electricidad", "analizador", "Energy Bill Analyzer"],
      ])
    )
  );
  const funnel = { chat_open: 3, chat_start: 2, chat_complete: 1, chat_qualified: 1, analyzer_view: 12, analyzer_calc: 5, analyzer_cta: 2 };
  const m = e.gas.v360ComputeMetrics(leads, {}, [], { goalStart: null, goalDays: 30, goalQualified: 10, budgetCap: 50, funnel }, new Date("2026-12-02T12:00:00Z"));
  const text = e.gas.v360PanelRows(m).map((r) => r.join(" = ")).join("\n");
  assert.match(text, /Energy Bill Analyzer = 1 \(0\)/);
  assert.match(text, /Visitas al analizador de factura = 12/);
  assert.match(text, /Solicitudes de comparación = 2/);
});

/* ---------- Recordatorios de vencimiento (nov. 2026) ---------- */
test("recordatorios: avisa al dueño 30 días antes, una sola vez, y respeta 'No contactar'", () => {
  const head = ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId", "Channel", "ContractExpiration"];
  const soon = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const rows = [head,
    ["2026-11-20T15:00:00Z", "Rosa Sintética", "(713) 000-3333", "77036", "Electricidad", "facebook", "", "", "", "", "Mobile", "L1", "recordatorio", soon],
    ["2026-11-20T16:00:00Z", "Luis Sintético", "(713) 000-4444", "77084", "Electricidad", "facebook", "", "", "", "", "Mobile", "L2", "recordatorio", later],
    ["2026-11-20T17:00:00Z", "Prueba QA", "(281) 555-0101", "77084", "Electricidad", "", "", "", "", "", "Mobile", "L3", "recordatorio", soon]];
  const e = createAppsScriptEnv({ sheets: { Leads: toSheetValues(rows) }, props: PROPS });
  e.gas.processNewLeads();
  const rem = e.sheet("Recordatorios").values;
  assert.equal(rem.length, 2, "solo Rosa: Luis vence en 90 días y la fila de prueba no cuenta");
  assert.equal(rem[1][1], "Rosa Sintética");
  assert.match(rem[1][8], /^https:\/\/wa\.me\/17130003333\?text=/);
  assert.match(decodeURIComponent(rem[1][8]), /vence el .*respóndeme "NO"/);
  const alerts = e.emails.filter((m) => /por vencer/.test(m.subject));
  assert.equal(alerts.length, 1);
  assert.doesNotMatch(alerts[0].htmlBody, /713|000-3333/, "sin teléfonos en el correo");
  e.gas.processNewLeads();
  assert.equal(e.sheet("Recordatorios").values.length, 2, "no se repite");
  assert.equal(e.emails.filter((m) => /por vencer/.test(m.subject)).length, 1);
});

test("recordatorios: no avisa si el lead pidió 'No contactar' o ya es cliente", () => {
  const e = createAppsScriptEnv({ sheets: { Leads: [[]] }, props: PROPS });
  const now = new Date("2026-12-01T12:00:00Z");
  const lead = (key, extra = {}) => ({ key, phone: "7130005555", status: "Nuevo", contractEnd: "2026-12-20", name: "Ana", zip: "77036", ...extra });
  const due = e.gas.v360DueReminders([lead("a"), lead("b"), lead("c"), lead("d", { contractEnd: "" })], now, {}, { b: "No contactar", c: "Inscrito" }, 30);
  assert.deepEqual(due.map((l) => l.key), ["a"]);
});
