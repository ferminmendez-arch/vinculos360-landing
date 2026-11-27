/* Pruebas del Agente de oportunidades (OpportunityAgent.js) con una hoja simulada y datos sintéticos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppsScriptEnv, toSheetValues } from "../automation/apps-script/harness.mjs";

const NOW = new Date("2026-12-02T13:00:00Z"); // 7 a. m. en Houston
const PROPS = { SPREADSHEET_ID: "MOCK", OWNER_EMAIL: "owner@example.com", GOAL_START: "2026-11-30" };
const LEADS_HEAD = ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId"];

function env({ opps = [], leads = [], props = {}, fetch } = {}) {
  const e = createAppsScriptEnv({
    sheets: {
      Leads: toSheetValues([LEADS_HEAD, ...leads]),
      ...(opps.length ? { Opportunities: [[], ...opps] } : {}),
    },
    props: { ...PROPS, ...props },
    extra: ["opportunities"],
    fetch,
  });
  if (opps.length) e.sheet("Opportunities").values[0] = [...e.gas.OPP.HEADERS];
  return e;
}

/* Fila "pegada" por el dueño: solo algunas columnas. */
function pasted(e, fields) {
  return e.gas.OPP.HEADERS.map((h) => (h in fields ? fields[h] : ""));
}

function rows(e) {
  const [head, ...rest] = e.sheet("Opportunities").values;
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const RECO = "¿Qué compañía de luz me recomiendan en Katy? Me llegó muy alta la factura este mes";

test("puntuación: pedido explícito de recomendación en español, en zona con opción y reciente → A", () => {
  const { gas } = env();
  const s = gas.oppScore({ summary: RECO, source: "Facebook grupo", interaction: "Manual", published: NOW }, NOW);
  assert.equal(s.type, "Busca recomendación");
  assert.equal(s.market, "Residencial");
  assert.equal(s.zone, "eleccion");
  assert.deepEqual({ ...s.parts }, { intent: 35, relevance: 25, geo: 20, recency: 10, interaction: 6 });
  assert.equal(s.score, 96);
  assert.equal(s.grade, "A");
});

test("puntuación: los pesos máximos suman 100 y respetan el plan (35/25/20/10/10)", () => {
  const { gas } = env();
  const s = gas.oppScore({ summary: RECO, interaction: "Permitida", published: NOW }, NOW);
  assert.equal(s.score, 100);
  assert.ok(s.parts.intent <= 35 && s.parts.relevance <= 25 && s.parts.geo <= 20 && s.parts.recency <= 10 && s.parts.interaction <= 10);
});

test("puntuación: área sin opción (Austin) o fuera de Texas nunca pasa de C", () => {
  const { gas } = env();
  const austin = gas.oppScore({ summary: "Busco proveedor de electricidad, alguien recomienda? en Austin", interaction: "Permitida", published: NOW }, NOW);
  assert.equal(austin.zone, "sin_eleccion");
  assert.equal(austin.grade, "C");
  const out = gas.oppScore({ summary: "recommend an electric company", location: "90210", interaction: "Permitida", published: NOW }, NOW);
  assert.equal(out.zone, "fuera");
  assert.equal(out.grade, "C");
});

test("puntuación: ZIP de Houston cuenta como zona con opción; la antigüedad baja el puntaje", () => {
  const { gas } = env();
  const fresh = gas.oppScore({ summary: "Just moved to 77036, need electricity", location: "77036", published: NOW }, NOW);
  const old = gas.oppScore({ summary: "Just moved to 77036, need electricity", location: "77036", published: new Date("2026-10-01T12:00:00Z") }, NOW);
  assert.equal(fresh.zone, "eleccion");
  assert.equal(fresh.type, "Mudanza / nuevo residente");
  assert.equal(fresh.parts.recency, 10);
  assert.equal(old.parts.recency, 0);
  assert.ok(fresh.score > old.score);
});

test("umbrales de grado configurables (OPP_GRADE_A / OPP_GRADE_B)", () => {
  const { gas } = env();
  const row = { summary: "Me mudo a Pasadena TX, qué hago con la luz?", published: NOW };
  const s = gas.oppScore(row, NOW);
  assert.equal(gas.oppScore(row, NOW, { a: s.score, b: 10 }).grade, "A");
  assert.equal(gas.oppScore(row, NOW, { a: 101, b: s.score + 1 }).grade, "C");
});

test("URL normalizada: ignora utm, fbclid, fragmentos y m./www.", () => {
  const { gas } = env();
  const a = gas.oppNormalizeUrl("https://www.facebook.com/groups/123/posts/456/?utm_source=x&fbclid=abc#c");
  const b = gas.oppNormalizeUrl("https://m.facebook.com/groups/123/posts/456");
  assert.equal(a, b);
  assert.equal(gas.oppNormalizeUrl("no es url"), "");
});

test("borradores: sin marcas de proveedores, precios, 'gratis' ni promesas; con enlace atribuido al analizador", () => {
  const { gas } = env();
  const s = gas.oppScore({ summary: RECO, interaction: "Manual", published: NOW }, NOW);
  const d = gas.oppDraft("OPP-20261202-001", s, { summary: RECO, source: "Facebook grupo", interaction: "Manual" });
  assert.match(d.draft, /utm_content=OPP-20261202-001#analizador/);
  assert.match(d.draft, /utm_medium=oportunidad/);
  assert.doesNotMatch(d.draft, /xoom|acn|vivint|at&t|directv|gratis|free|ahorr|garantiz|\$\d|%/i);
  const en = gas.oppDraft("OPP-1", gas.oppScore({ summary: "Can anyone recommend an electricity company in Houston?" }, NOW), { summary: "Can anyone recommend an electricity company in Houston?", source: "Reddit" });
  assert.match(en.draft, /vinculos360\.com\/en\//);
});

test("borradores: no se propone responder en fuentes que no lo permiten ni en áreas sin opción", () => {
  const { gas } = env();
  const s = gas.oppScore({ summary: RECO, interaction: "No permitida" }, NOW);
  assert.equal(gas.oppDraft("OPP-1", s, { summary: RECO, interaction: "No permitida" }).draft, "");
  const austin = gas.oppScore({ summary: "recomienden compañía de luz en Austin" }, NOW);
  assert.equal(gas.oppDraft("OPP-2", austin, { summary: "x" }).draft, "");
});

test("discoverOpportunities completa filas pegadas, marca duplicados y no toca lo que escribió el dueño", () => {
  const e = env({ opps: [[]] });
  const sheet = e.sheet("Opportunities");
  sheet.values = [
    [...e.gas.OPP.HEADERS],
    pasted(e, { Fuente: "Facebook grupo", URL: "https://www.facebook.com/groups/1/posts/2?utm_source=x", Resumen: RECO, Interacción: "Manual" }),
    pasted(e, { Fuente: "Facebook grupo", URL: "https://m.facebook.com/groups/1/posts/2", Resumen: "La misma publicación" }),
    pasted(e, { "Opportunity ID": "OPP-20261201-001", Identificada: new Date("2026-12-01T12:00:00Z"), Fuente: "Nextdoor", URL: "https://nextdoor.com/p/abc", Resumen: "new homes", Score: 50, Grado: "C", Estado: "Contactada", "Borrador de respuesta": "mi texto editado", Clave: "https://nextdoor.com/p/abc" }),
  ];
  e.gas.discoverOpportunities(NOW);
  const [first, dup, owner] = rows(e);
  assert.match(first["Opportunity ID"], /^OPP-\d{8}-\d{3}$/);
  assert.equal(first.Grado, "A");
  assert.equal(first.Estado, "Nueva");
  assert.equal(first.Tipo, "Busca recomendación");
  assert.ok(first["Borrador de respuesta"].includes(first["Opportunity ID"]));
  assert.equal(dup.Estado, "Descartada");
  assert.equal(dup.Resultado, `Duplicado de ${first["Opportunity ID"]}`);
  assert.equal(owner.Estado, "Contactada");
  assert.equal(owner["Borrador de respuesta"], "mi texto editado");
  assert.equal(owner.Score, 50);
});

test("una oportunidad solo se vuelve lead cuando llega un lead con consentimiento y su utm_content", () => {
  const e = env({
    opps: [[]],
    leads: [
      ["2026-12-01T18:00:00Z", "Cliente Sintético", "(713) 000-2222", "77036", "Electricidad", "facebook-grupo", "oportunidad", "opportunity-agent", "OPP-20261201-001", "", "Mobile", "L-abc123"],
      ["2026-12-01T19:00:00Z", "Prueba QA", "(281) 555-0101", "77036", "Electricidad", "facebook-grupo", "oportunidad", "opportunity-agent", "OPP-20261201-002", "", "Mobile", "L-test"],
    ],
  });
  e.sheet("Opportunities").values = [
    [...e.gas.OPP.HEADERS],
    pasted(e, { "Opportunity ID": "OPP-20261201-001", Identificada: new Date("2026-12-01T12:00:00Z"), Fuente: "Facebook grupo", URL: "https://facebook.com/groups/1/posts/9", Resumen: RECO, Score: 90, Grado: "A", Estado: "Contactada", Clave: "https://facebook.com/groups/1/posts/9" }),
    pasted(e, { "Opportunity ID": "OPP-20261201-002", Identificada: new Date("2026-12-01T12:00:00Z"), Fuente: "Facebook grupo", URL: "https://facebook.com/groups/1/posts/10", Resumen: RECO, Score: 90, Grado: "A", Estado: "Contactada", Clave: "https://facebook.com/groups/1/posts/10" }),
  ];
  e.gas.discoverOpportunities(NOW);
  const [real, test] = rows(e);
  assert.equal(real.Estado, "Convertida en lead");
  assert.equal(real["Lead ID"], "L-abc123");
  assert.equal(test.Estado, "Contactada", "las filas de prueba no convierten oportunidades");
  assert.equal(test["Lead ID"], "");
});

test("TREC: solo agentes activos con licencia nueva, máximo diario y sin duplicar", () => {
  const record = (n, date, extra = {}) => ({
    license_type: "Sales Agent", license_number: `9${n}-SA`, full_name: `AGENTE SINTETICO ${n}`, status: "Active",
    original_license_date: date, county: "HARRIS", related_license_full_name: "BROKER SINTETICO LLC", ...extra,
  });
  const records = [
    record(1, "11/20/2026"), record(2, "11/25/2026"), record(3, "01/05/2019"),
    record(4, "11/26/2026", { status: "Inactive" }), record(5, "11/27/2026"), record(6, "11/28/2026"), record(7, "11/29/2026"), record(8, "11/30/2026"),
  ];
  const e = env({ opps: [[]], props: { OPP_TREC_DAILY_MAX: "3" }, fetch: () => ({ code: 200, body: JSON.stringify(records) }) });
  e.sheet("Opportunities").values = [[...e.gas.OPP.HEADERS]];
  e.gas.discoverOpportunities(NOW);
  let r = rows(e);
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.Mercado === "Trade" && x.Tipo === "Profesional inmobiliario" && x.Interacción === "Manual"));
  assert.ok(r.every((x) => /data\.texas\.gov\/resource\/s7ft-44qi\.json\?license_number=/.test(x.URL)));
  assert.ok(r.every((x) => !/@|\(\d{3}\)/.test(x.Resumen)), "sin correos ni teléfonos");
  assert.match(e.fetches[0], /upper\(county\)%20in\(/);
  e.gas.discoverOpportunities(NOW);
  r = rows(e);
  assert.equal(r.length, 6, "al día siguiente agrega los que faltan (6 válidos), sin repetir");
  assert.equal(new Set(r.map((x) => x.Clave)).size, 6);
  e.gas.discoverOpportunities(NOW);
  assert.equal(rows(e).length, 6, "no hay más que agregar");
});

test("si TREC falla, el agente sigue y lo reporta como fuente no disponible", () => {
  const e = env({ opps: [[]], fetch: () => ({ code: 503, body: "" }) });
  e.sheet("Opportunities").values = [[...e.gas.OPP.HEADERS], pasted(e, { Fuente: "Manual", URL: "https://example.com/a", Resumen: RECO })];
  assert.equal(e.gas.discoverOpportunities(NOW), "Listo");
  const last = JSON.parse(e.properties.OPP_SOURCES_LAST);
  assert.equal(last.sources[0].ok, false);
  assert.match(last.sources[0].note, /503/);
  assert.equal(rows(e)[0].Grado, "A");
});

test("dashboard Embudo: etapas separadas y sin cifras inventadas", () => {
  const e = env({ opps: [[]], props: { OPP_TREC_ENABLED: "false" } });
  e.sheet("Opportunities").values = [[...e.gas.OPP.HEADERS], pasted(e, { Fuente: "Manual", URL: "https://example.com/a", Resumen: RECO })];
  e.gas.discoverOpportunities(NOW);
  const embudo = Object.fromEntries(e.sheet("Embudo").values.map((r) => [String(r[0]).trim(), r[1]]));
  assert.equal(embudo.Identificadas, 1);
  assert.equal(embudo["Convertidas en lead"], 0);
  assert.equal(embudo["Visitas al analizador de factura"], "sin datos");
  assert.equal(embudo["Gasto en anuncios"], "sin gasto registrado");
  assert.equal(embudo["Costo de adquisición (por inscripción)"], "sin datos");
  assert.ok("Definiciones" in embudo);
});

test("resumen diario: sin oportunidades dice que no hay (no inventa) y avisa si el agente no corrió", () => {
  const e = env({ opps: [[]] });
  e.sheet("Opportunities").values = [[...e.gas.OPP.HEADERS]];
  e.gas.sendDailyBrief(NOW);
  assert.equal(e.emails.length, 1);
  const html = e.emails[0].htmlBody;
  assert.match(html, /Sin oportunidades nuevas verificadas/);
  assert.match(html, /No hay oportunidades A abiertas/);
  assert.match(html, /no corrió en las últimas 26 horas/);
  assert.match(e.emails[0].subject, /0 A · 0 nuevas/);
});

test("resumen diario: incluye URL verificable, acción y borrador de las oportunidades A", () => {
  const e = env({ opps: [[]], props: { OPP_TREC_ENABLED: "false" } });
  e.sheet("Opportunities").values = [[...e.gas.OPP.HEADERS], pasted(e, { Fuente: "Facebook grupo", URL: "https://facebook.com/groups/1/posts/77", Resumen: RECO, Interacción: "Manual" })];
  e.gas.discoverOpportunities(NOW);
  e.gas.sendDailyBrief(NOW);
  const html = e.emails.at(-1).htmlBody;
  assert.match(html, /href="https:\/\/facebook\.com\/groups\/1\/posts\/77"/);
  assert.match(html, /Acción:/);
  assert.match(html, /Borrador:/);
  assert.doesNotMatch(html, /no corrió/);
});

test("setupOpportunities crea la pestaña y activadores diarios 6 y 7 a. m. sin duplicarlos", () => {
  const e = env();
  e.gas.setupOpportunities();
  e.gas.setupOpportunities();
  assert.deepEqual(e.sheet("Opportunities").values[0], [...e.gas.OPP.HEADERS]);
  const daily = e.triggers.filter((t) => ["discoverOpportunities", "sendDailyBrief"].includes(t.handler));
  assert.equal(daily.length, 2);
  assert.deepEqual(daily.map((t) => t.atHour).sort(), [6, 7]);
});

test("neutraliza fórmulas en textos copiados de fuentes externas", () => {
  const { gas } = env();
  const row = gas.oppToRow({ summary: "=IMPORTXML(\"http://x\")", source: "+cmd" });
  assert.ok(row.includes("'=IMPORTXML(\"http://x\")"));
  assert.ok(row.includes("'+cmd"));
});

test("autoprueba sin acceso a la hoja", () => {
  const { gas } = env();
  const lines = gas.runOpportunitySelfTest();
  assert.equal(lines.length, 3);
  assert.match(lines[1], /\(dup\)/);
  assert.match(lines[2], / C /);
});
