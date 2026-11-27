/* global V360, v360EnsureSheet, v360LoadAll, v360Log, v360Settings, v360Spreadsheet -- definidas en LeadAgent.js (mismo proyecto de Apps Script) */
/* =========================================================
   VÍNCULOS 360 — AGENTE DE INTELIGENCIA DE BÚSQUEDA (Google)

   Vive en el mismo proyecto de Apps Script que LeadAgent.js
   ("Vinculos 365") y reutiliza su configuración, la hoja y el correo
   al dueño. Cada lunes junta, sin datos personales:

     Search Console  – impresiones, clics, CTR, posición y consultas
                       (API oficial, solo lectura).
     Google Analytics 4 – eventos del embudo: analyzer_started,
                       analyzer_completed, comparison_requested,
                       lead_submitted, whatsapp_clicked (API Data v1beta).
     Hoja de leads   – leads que llegaron desde Google, calificados e
                       inscritos (customer_enrolled sale del Estado
                       "Inscrito"/"Cliente" que marca el dueño).

   Escribe una fila en la pestaña "Google" y envía el reporte al dueño.
   Si una API no responde (permiso, API sin activar, propiedad sin
   verificar), el reporte lo dice tal cual: nunca inventa cifras.

   Costos: Search Console API y Analytics Data API no cobran por uso.
   Cuotas: Search Console 1,200 consultas/min por sitio; GA4 estándar
   200,000 tokens/día por propiedad. Este agente hace 4 llamadas por semana.

   Funciones para el editor:
     setupSearchAgent()   – crea la pestaña y el activador (lunes 8:30).
     sendSearchReport()   – reporte semanal (lo llama el activador).
     testSearchAccess()   – comprueba permisos de ambas APIs sin escribir nada.

   Propiedades opcionales:
     GSC_SITE_URL     por defecto https://www.vinculos360.com/
     GA4_PROPERTY_ID  por defecto 566078481
========================================================= */

var GSI = {
  SHEET: "Google",
  HEADERS: [
    "Semana (inicio)", "Semana (fin)", "Impresiones", "Clics", "CTR %", "Posición media",
    "Consultas con impresiones", "analyzer_started", "analyzer_completed", "comparison_requested",
    "lead_submitted", "whatsapp_clicked", "Leads desde Google", "Calificados desde Google",
    "Inscritos (total semana)", "Estado de las fuentes",
  ],
  SITE_URL: "https://www.vinculos360.com/",
  GA4_PROPERTY_ID: "566078481",
  FUNNEL: ["analyzer_started", "analyzer_completed", "comparison_requested", "lead_submitted", "whatsapp_clicked"],
  /* Search Console publica los datos con 2–3 días de retraso. */
  LAG_DAYS: 3,
  /* Palabras que indican intención comercial de energía eléctrica (ES/EN). */
  INTENT_WORDS: ["luz", "electricidad", "energia", "electric", "electricity", "kwh", "power", "light company", "tarifa", "factura", "bill", "plan"],
  /* Consultas que ya cubre una guía (para no proponer guías duplicadas). */
  GUIDE_TOPICS: [
    { slug: "costo-por-kwh", words: ["kwh", "precio", "costo", "rate", "price", "efl"] },
    { slug: "factura-de-luz-alta", words: ["alta", "subio", "high", "bill", "factura", "recibo"] },
    { slug: "vence-tu-contrato-de-luz", words: ["contrato", "vence", "renovar", "renew", "contract", "expir"] },
    { slug: "mudanza-luz-texas", words: ["mudanza", "mudar", "casa nueva", "move", "moving", "set up", "conectar"] },
  ],
};

/* ---------- Núcleo (puro, probado con node --test) ---------- */

function gsiYmd(date) {
  return date.toISOString().slice(0, 10);
}

/* Últimos 7 días completos con datos (terminando LAG_DAYS antes de hoy). */
function gsiWeekRange(now) {
  var end = new Date(now.getTime() - GSI.LAG_DAYS * 86400000);
  var start = new Date(end.getTime() - 6 * 86400000);
  return { start: gsiYmd(start), end: gsiYmd(end) };
}

function gsiFold(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* Totales a partir de filas de Search Console agrupadas por consulta. */
function gsiTotals(rows) {
  var t = { impressions: 0, clicks: 0, queries: 0, weightedPosition: 0 };
  (rows || []).forEach(function (r) {
    t.impressions += r.impressions || 0;
    t.clicks += r.clicks || 0;
    t.weightedPosition += (r.position || 0) * (r.impressions || 0);
    t.queries += 1;
  });
  return {
    impressions: t.impressions,
    clicks: t.clicks,
    ctrPct: t.impressions ? Math.round((t.clicks / t.impressions) * 1000) / 10 : null,
    position: t.impressions ? Math.round((t.weightedPosition / t.impressions) * 10) / 10 : null,
    queries: t.queries,
  };
}

function gsiHasIntent(query) {
  var q = gsiFold(query);
  return GSI.INTENT_WORDS.some(function (w) { return q.indexOf(w) !== -1; });
}

function gsiCoveringGuide(query) {
  var q = gsiFold(query);
  for (var i = 0; i < GSI.GUIDE_TOPICS.length; i++) {
    if (GSI.GUIDE_TOPICS[i].words.some(function (w) { return q.indexOf(w) !== -1; })) return GSI.GUIDE_TOPICS[i].slug;
  }
  return "";
}

/* Oportunidades SEO concretas a partir de las consultas (máximo 8). */
function gsiOpportunities(rows) {
  var out = [];
  (rows || []).forEach(function (r) {
    var query = r.keys ? r.keys[0] : r.query;
    if (!query || !gsiHasIntent(query)) return;
    var ctr = r.impressions ? r.clicks / r.impressions : 0;
    var guide = gsiCoveringGuide(query);
    if (r.position > 3 && r.position <= 20 && r.impressions >= 10) {
      out.push({ query: query, type: "Subir al top 3", detail: "Posición " + r.position.toFixed(1) + " con " + r.impressions + " impresiones." + (guide ? " Refuerza la guía " + guide + "." : " Considera una guía nueva."), score: r.impressions / r.position });
    } else if (r.position <= 5 && r.impressions >= 30 && ctr < 0.02) {
      out.push({ query: query, type: "Mejorar título/descripción", detail: "Aparece arriba (posición " + r.position.toFixed(1) + ") pero casi nadie hace clic.", score: r.impressions });
    } else if (!guide && r.impressions >= 5) {
      out.push({ query: query, type: "Tema sin guía", detail: r.impressions + " impresiones y ninguna guía lo cubre.", score: r.impressions / 2 });
    }
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out.slice(0, 8);
}

/* Suma eventos GA4 (respuesta de runReport con dimensión eventName). */
function gsiGaEvents(report) {
  var out = {};
  GSI.FUNNEL.forEach(function (e) { out[e] = 0; });
  ((report && report.rows) || []).forEach(function (row) {
    var name = row.dimensionValues[0].value;
    if (name in out) out[name] += Number(row.metricValues[0].value) || 0;
  });
  return out;
}

/* ¿El lead llegó desde Google (búsqueda orgánica o anuncio)? */
function gsiIsGoogleLead(lead) {
  var s = gsiFold(lead.source);
  return /(^|\.)google\./.test(s) || s === "google";
}

/* Leads de la semana desde Google y clientes inscritos en la semana (por fecha de recepción). */
function gsiLeadCounts(leads, statusByKey, startYmd, endYmd) {
  var start = new Date(startYmd + "T00:00:00");
  var end = new Date(new Date(endYmd + "T00:00:00").getTime() + 86400000);
  var out = { google: 0, googleQualified: 0, enrolled: 0 };
  (leads || []).forEach(function (l) {
    var t = l.receivedAt instanceof Date ? l.receivedAt : new Date(l.receivedAt);
    if (!l.receivedAt || isNaN(t.getTime()) || t < start || t >= end) return;
    var status = (statusByKey && statusByKey[l.key]) || l.status;
    if (status === "Prueba" || status === "Duplicado") return;
    var qualified = V360.QUALIFIED_STATUSES.indexOf(status) !== -1;
    if (V360.ENROLLED_STATUSES.indexOf(status) !== -1) out.enrolled += 1;
    if (gsiIsGoogleLead(l)) {
      out.google += 1;
      if (qualified) out.googleQualified += 1;
    }
  });
  return out;
}

function gsiRow(range, gsc, ga, leads, status) {
  return [
    range.start, range.end,
    gsc ? gsc.impressions : "", gsc ? gsc.clicks : "", gsc && gsc.ctrPct != null ? gsc.ctrPct : "", gsc && gsc.position != null ? gsc.position : "",
    gsc ? gsc.queries : "",
  ].concat(GSI.FUNNEL.map(function (e) { return ga ? ga[e] : ""; }))
    .concat([leads.google, leads.googleQualified, leads.enrolled, status.join(" · ")]);
}

function gsiEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function gsiReportHtml(ctx) {
  var dash = "sin datos";
  var g = ctx.gsc;
  var lines = [
    "<h2>Google — semana del " + ctx.range.start + " al " + ctx.range.end + "</h2>",
    "<p><b>Búsqueda (Search Console)</b><br>",
    g ? "Impresiones: " + g.impressions + " · Clics: " + g.clicks + " · CTR: " + (g.ctrPct == null ? dash : g.ctrPct + " %") + " · Posición media: " + (g.position == null ? dash : g.position) : dash,
    "</p><p><b>Embudo en el sitio (GA4)</b><br>",
    ctx.ga ? GSI.FUNNEL.map(function (e) { return e + ": " + ctx.ga[e]; }).join(" · ") : dash,
    "</p><p><b>Resultados</b><br>Leads desde Google: " + ctx.leads.google + " · Calificados desde Google: " + ctx.leads.googleQualified + " · Clientes inscritos en la semana (todas las fuentes): " + ctx.leads.enrolled + "</p>",
  ];
  if (ctx.topQueries && ctx.topQueries.length) {
    lines.push("<p><b>Consultas principales</b></p><table border='1' cellpadding='4' style='border-collapse:collapse'><tr><th>Consulta</th><th>Impr.</th><th>Clics</th><th>Pos.</th></tr>");
    ctx.topQueries.slice(0, 10).forEach(function (r) {
      lines.push("<tr><td>" + gsiEsc(r.keys[0]) + "</td><td>" + r.impressions + "</td><td>" + r.clicks + "</td><td>" + r.position.toFixed(1) + "</td></tr>");
    });
    lines.push("</table>");
  }
  lines.push("<p><b>Oportunidades SEO</b></p>");
  lines.push(ctx.opportunities.length
    ? "<ul>" + ctx.opportunities.map(function (o) { return "<li><b>" + gsiEsc(o.query) + "</b> — " + o.type + ": " + gsiEsc(o.detail) + "</li>"; }).join("") + "</ul>"
    : "<p>Aún no hay suficientes datos de búsqueda para proponer cambios.</p>");
  lines.push("<p style='color:#666'>Fuentes: " + gsiEsc(ctx.status.join(" · ")) + "</p>");
  return lines.join("\n");
}

/* ---------- Acceso a las APIs ---------- */

function gsiSettings() {
  var props = PropertiesService.getScriptProperties();
  return {
    site: props.getProperty("GSC_SITE_URL") || GSI.SITE_URL,
    property: props.getProperty("GA4_PROPERTY_ID") || GSI.GA4_PROPERTY_ID,
  };
}

function gsiPost(url, body) {
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code !== 200) {
    var reason;
    try { reason = JSON.parse(text).error.message; } catch (e) { reason = text.slice(0, 160); }
    throw new Error("HTTP " + code + ": " + reason);
  }
  return JSON.parse(text);
}

function gsiFetchQueries(site, range) {
  var url = "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(site) + "/searchAnalytics/query";
  var data = gsiPost(url, { startDate: range.start, endDate: range.end, dimensions: ["query"], rowLimit: 250, dataState: "final" });
  return data.rows || [];
}

function gsiFetchGa(property, range) {
  var url = "https://analyticsdata.googleapis.com/v1beta/properties/" + property + ":runReport";
  return gsiPost(url, {
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: GSI.FUNNEL } } },
  });
}

/* Junta todo. Cada fuente falla por separado y se informa. */
function gsiCollect(now, deps) {
  var range = gsiWeekRange(now);
  var settings = gsiSettings();
  var status = [];
  var gsc = null, ga = null, rows = [];
  try {
    rows = gsiFetchQueries(settings.site, range);
    gsc = gsiTotals(rows);
    status.push("Search Console: ok");
  } catch (e) {
    status.push("Search Console: " + e.message);
  }
  try {
    ga = gsiGaEvents(gsiFetchGa(settings.property, range));
    status.push("GA4: ok");
  } catch (e) {
    status.push("GA4: " + e.message);
  }
  var leads = { google: 0, googleQualified: 0, enrolled: 0 };
  try {
    var data = deps.loadAll();
    leads = gsiLeadCounts(data.leads, data.tracking.statusByKey, range.start, range.end);
    status.push("Hoja: ok");
  } catch (e) {
    status.push("Hoja: " + e.message);
  }
  rows.sort(function (a, b) { return b.impressions - a.impressions; });
  return { range: range, gsc: gsc, ga: ga, leads: leads, topQueries: rows, opportunities: gsiOpportunities(rows), status: status };
}

function sendSearchReport() {
  var settings = v360Settings();
  var ss = v360Spreadsheet(settings);
  var ctx = gsiCollect(new Date(), { loadAll: function () { return v360LoadAll(ss); } });
  var sheet = v360EnsureSheet(ss, GSI.SHEET, GSI.HEADERS);
  sheet.appendRow(gsiRow(ctx.range, ctx.gsc, ctx.ga, ctx.leads, ctx.status));
  MailApp.sendEmail({
    to: settings.ownerEmail,
    subject: "Google semanal Vínculos 360: " + (ctx.gsc ? ctx.gsc.clicks + " clics" : "sin datos de búsqueda") + ", " + ctx.leads.google + " leads",
    htmlBody: gsiReportHtml(ctx),
  });
  v360Log(ss, "info", "Reporte de Google enviado. " + ctx.status.join(" · "));
  return ctx.status;
}

function testSearchAccess() {
  var ctx = gsiCollect(new Date(), { loadAll: function () { return { leads: [], tracking: { statusByKey: {} } }; } });
  console.log(ctx.status.join("\n"));
  return ctx.status;
}

function setupSearchAgent() {
  var ss = v360Spreadsheet(v360Settings());
  v360EnsureSheet(ss, GSI.SHEET, GSI.HEADERS);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendSearchReport") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendSearchReport").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(30).create();
  v360Log(ss, "info", "Agente de búsqueda: activador lunes 8:30.");
  return "Listo";
}
