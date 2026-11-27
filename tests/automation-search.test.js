/* Agente de inteligencia de búsqueda (SearchAgent.js) con el simulador de Apps Script. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppsScriptEnv } from "../automation/apps-script/harness.mjs";

const LEADS_HEADER = ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device"];

const GSC_ROWS = [
  { keys: ["compañias de luz en houston"], clicks: 2, impressions: 120, ctr: 0.016, position: 8.4 },
  { keys: ["como calcular costo por kwh"], clicks: 0, impressions: 60, ctr: 0, position: 2.1 },
  { keys: ["luz para casa nueva houston"], clicks: 1, impressions: 15, ctr: 0.066, position: 25 },
  { keys: ["tarifa electrica comercial austin hoy"], clicks: 0, impressions: 6, ctr: 0, position: 40 },
  { keys: ["vinculos 360"], clicks: 5, impressions: 9, ctr: 0.55, position: 1 },
];

const GA_REPORT = {
  rows: [
    { dimensionValues: [{ value: "analyzer_started" }], metricValues: [{ value: "14" }] },
    { dimensionValues: [{ value: "analyzer_completed" }], metricValues: [{ value: "9" }] },
    { dimensionValues: [{ value: "lead_submitted" }], metricValues: [{ value: "2" }] },
    { dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "999" }] },
  ],
};

function env({ gsc = { code: 200, body: JSON.stringify({ rows: GSC_ROWS }) }, ga = { code: 200, body: JSON.stringify(GA_REPORT) } } = {}) {
  const calls = [];
  const e = createAppsScriptEnv({
    extra: ["search"],
    props: { SPREADSHEET_ID: "X", OWNER_EMAIL: "owner@example.com" },
    sheets: {
      Leads: [
        LEADS_HEADER,
        [new Date("2026-11-30T15:00:00Z"), "Ana Real", "(713) 482-1100", "77001", "Electricidad", "www.google.com", "", "", "guia-costo-por-kwh", "", "Mobile"],
        [new Date("2026-11-30T16:00:00Z"), "Luis Real", "(832) 482-2200", "77084", "Electricidad", "facebook", "grupo", "", "", "", "Mobile"],
        [new Date("2026-11-30T17:00:00Z"), "Prueba QA", "(281) 555-0100", "77001", "Electricidad", "google.com", "", "", "", "", "Mobile"],
        [new Date("2026-10-01T17:00:00Z"), "Vieja Real", "(281) 482-3300", "77001", "Electricidad", "google.com", "", "", "", "", "Mobile"],
      ],
    },
    fetch: (url, options) => {
      calls.push({ url, options });
      if (url.includes("searchAnalytics")) return gsc;
      if (url.includes("analyticsdata")) return ga;
      return { code: 404, body: "" };
    },
  });
  return { ...e, calls };
}

test("semana: 7 días completos que terminan 3 días antes (retraso de Search Console)", () => {
  const { gas } = env();
  assert.deepEqual({ ...gas.gsiWeekRange(new Date("2026-12-07T14:00:00Z")) }, { start: "2026-11-28", end: "2026-12-04" });
});

test("totales: CTR y posición ponderada por impresiones", () => {
  const { gas } = env();
  const t = gas.gsiTotals(GSC_ROWS);
  assert.equal(t.impressions, 210);
  assert.equal(t.clicks, 8);
  assert.equal(t.ctrPct, 3.8);
  assert.equal(t.queries, 5);
  assert.equal(gas.gsiTotals([]).ctrPct, null, "sin impresiones no se inventa un CTR");
});

test("oportunidades: top 3, título/descripción y temas sin guía; ignora la marca y sin intención", () => {
  const { gas } = env();
  const ops = gas.gsiOpportunities(GSC_ROWS);
  const byQuery = Object.fromEntries(ops.map((o) => [o.query, o.type]));
  assert.equal(byQuery["compañias de luz en houston"], "Subir al top 3");
  assert.equal(byQuery["como calcular costo por kwh"], "Mejorar título/descripción");
  assert.equal(byQuery["tarifa electrica comercial austin hoy"], "Tema sin guía");
  assert.equal(byQuery["vinculos 360"], undefined);
});

test("GA4: solo cuenta los eventos del embudo", () => {
  const { gas } = env();
  assert.deepEqual({ ...gas.gsiGaEvents(GA_REPORT) }, {
    analyzer_started: 14,
    analyzer_completed: 9,
    comparison_requested: 0,
    lead_submitted: 2,
    whatsapp_clicked: 0,
  });
});

test("reporte: escribe la pestaña Google, manda un correo y usa el token OAuth", () => {
  const e = env();
  e.gas.Date = class extends Date {
    constructor(...a) {
      super(...(a.length ? a : ["2026-12-07T14:00:00Z"]));
    }
  };
  const status = e.gas.sendSearchReport();
  assert.deepEqual([...status], ["Search Console: ok", "GA4: ok", "Hoja: ok"]);
  const sheet = e.sheet("Google");
  assert.equal(sheet.values[0][0], "Semana (inicio)");
  const row = sheet.values[1];
  assert.equal(row[2], 210);
  assert.equal(row[7], 14);
  assert.equal(row[12], 1, "un lead real desde Google en la semana (sin pruebas ni fuera de rango)");
  assert.equal(e.emails.length, 1);
  assert.match(e.emails[0].htmlBody, /Oportunidades SEO/);
  assert.doesNotMatch(e.emails[0].htmlBody, /Ana Real|713/, "el reporte no lleva datos personales");
  const gscCall = e.calls.find((c) => c.url.includes("searchAnalytics"));
  assert.match(gscCall.url, /sites\/https%3A%2F%2Fwww\.vinculos360\.com%2F\/searchAnalytics\/query$/);
  assert.equal(gscCall.options.headers.Authorization, "Bearer TOKEN-SIMULADO");
});

test("si Search Console no da acceso, el reporte lo dice y no inventa cifras", () => {
  const e = env({ gsc: { code: 403, body: JSON.stringify({ error: { message: "User does not have sufficient permission for site" } }) } });
  const ctx = e.gas.gsiCollect(new Date("2026-12-07T14:00:00Z"), { loadAll: () => ({ leads: [], tracking: { statusByKey: {} } }) });
  assert.equal(ctx.gsc, null);
  assert.match(ctx.status[0], /Search Console: HTTP 403: User does not have sufficient permission/);
  assert.match(e.gas.gsiReportHtml(ctx), /sin datos/);
  assert.equal(ctx.ga.analyzer_started, 14, "GA4 sigue funcionando aunque falle Search Console");
});
