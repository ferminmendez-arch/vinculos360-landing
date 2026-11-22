/* =========================================================
   Demo del panel de leads con datos FICTICIOS.
   Ejecuta el agente real (LeadAgent.js) contra una hoja simulada y
   genera automation/out/panel-demo.html para ver cómo se verá
   el Panel, la pestaña Seguimiento y el reporte semanal.

   Uso: node automation/apps-script/demo-report.mjs [--now 2026-12-06T15:00:00Z]
========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppsScriptEnv, toSheetValues } from "./harness.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const mock = JSON.parse(fs.readFileSync(path.join(DIR, "..", "mock", "leads.json"), "utf8"));

export function buildDemo({ now = new Date("2026-12-06T15:00:00Z") } = {}) {
  const env = createAppsScriptEnv({
    sheets: { Leads: toSheetValues(mock.rows), Gastos: toSheetValues(mock.spend) },
    props: { SPREADSHEET_ID: "MOCK", GOAL_START: "2026-11-30", OWNER_EMAIL: "owner@example.com" },
  });
  env.gas.processNewLeads();

  // El dueño marca dos leads como calificados (simulación).
  const tracking = env.sheet("Seguimiento");
  const statusCol = tracking.values[0].indexOf("Estado");
  const nameCol = tracking.values[0].indexOf("Nombre");
  tracking.values.forEach((row, i) => {
    if (i && ["Pedro Salas", "Jorge Méndez"].includes(row[nameCol])) row[statusCol] = "Calificado";
    if (i && row[nameCol] === "Raúl Peña") row[statusCol] = "Contactado";
  });

  const settings = { goalStart: new Date("2026-11-30T00:00:00-06:00"), goalDays: 30, goalQualified: 10, budgetCap: 50 };
  const leads = env.gas.v360ClassifyLeads(env.gas.v360ReadLeads(env.sheet("Leads").values));
  const statusByKey = Object.fromEntries(tracking.values.slice(1).map((r) => [r[0], r[statusCol]]));
  const spend = env.sheet("Gastos").values.slice(1).map((r) => ({ date: new Date(r[0]), amount: Number(r[3]) }));
  const metrics = env.gas.v360ComputeMetrics(leads, statusByKey, spend, settings, now);
  return { env, metrics, tracking, report: env.gas.v360ReportHtml(metrics, "") };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function renderPage({ metrics, tracking, report }) {
  const head = tracking.values[0];
  const cols = ["Recibido", "Nombre", "ZIP", "Servicio", "Origen", "Contenido/anuncio", "Prioridad", "Clasificación", "Estado"];
  const idx = cols.map((c) => head.indexOf(c));
  const rows = tracking.values.slice(1).map((r) =>
    `<tr>${idx.map((i, j) => {
      const v = r[i] instanceof Date ? r[i].toISOString().slice(0, 16).replace("T", " ") : r[i];
      const cls = cols[j] === "Prioridad" ? ` class="p p${esc(v)}"` : "";
      return `<td${cls}>${esc(v)}</td>`;
    }).join("")}</tr>`).join("");
  const tile = (label, value, sub = "") => `<div class="tile"><div class="lbl">${esc(label)}</div><div class="val">${esc(value)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`;
  const money = (n) => (n == null ? "sin datos" : `$${n.toFixed(2)}`);
  const pct = Math.min(100, Math.round((metrics.qualified / metrics.goal) * 100));
  const bars = (items) => {
    const max = Math.max(1, ...items.map((i) => i.count));
    return items.map((i) => `<div class="bar"><span>${esc(i.key)}</span><div><i style="width:${(i.count / max) * 100}%"></i></div><b>${i.count}</b></div>`).join("");
  };
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel de leads (demo) — Vínculos 360</title>
<style>
:root{--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--navy:#0b3a6e;--orange:#f28c28;--bg:#f8fafc}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:1100px;margin:0 auto;padding:28px 20px 60px}h1{font-size:24px;margin:0;color:var(--navy)}h2{font-size:17px;margin:32px 0 12px}
.note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:10px;margin:14px 0 22px;font-size:14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.tile{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.lbl{color:var(--mut);font-size:13px}.val{font-size:26px;font-weight:700;margin-top:4px}.sub{color:var(--mut);font-size:12px}
.goal{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:12px}.track{height:12px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:8px}.track i{display:block;height:100%;background:var(--orange)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
.bar{display:grid;grid-template-columns:1.4fr 2fr 28px;gap:8px;align-items:center;font-size:13px;margin:6px 0}.bar div{background:#eef2f7;border-radius:6px;height:10px}.bar i{display:block;height:100%;background:var(--navy);border-radius:6px}.bar b{text-align:right}
.tablewrap{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:12px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}th{background:#f1f5f9;font-weight:600}
.p{font-weight:700;text-align:center}.pA{color:#15803d}.pB{color:#1d4ed8}.pC{color:#b45309}
.report{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
</style></head><body><main>
<h1>Panel de leads — Vínculos 360</h1>
<div class="note"><b>Demostración con datos ficticios.</b> Así se verán las pestañas Panel y Seguimiento en tu Google Sheet. Las cifras reales salen solo de tu hoja; nada se estima.</div>
<div class="tiles">
${tile("Calificados", `${metrics.qualified} / ${metrics.goal}`, "estado puesto por el equipo")}
${tile("Leads válidos", metrics.leadsValid, `${metrics.excludedTests} prueba(s) y ${metrics.excludedDuplicates} duplicado(s) excluidos`)}
${tile("Electricidad Texas (A)", metrics.electricityTexas, "ZIP con opción probable")}
${tile("Sin contactar > 24 h", metrics.pendingOver24h)}
${tile("Gasto registrado", money(metrics.spend), `tope ${money(metrics.budgetCap)}`)}
${tile("Costo por lead", money(metrics.costPerLead), `por calificado: ${money(metrics.costPerQualified)}`)}
</div>
<div class="goal"><b>Meta: ${metrics.goal} leads calificados en ${metrics.period ? metrics.period.days : 30} días</b> — día ${metrics.period ? metrics.period.daysElapsed : "–"}
<div class="track"><i style="width:${pct}%"></i></div></div>
<h2>¿De dónde vienen?</h2>
<div class="cols"><div class="card"><b>Por origen</b>${bars(metrics.bySource)}</div><div class="card"><b>Por campaña / publicación</b>${bars(metrics.byContent)}</div><div class="card"><b>Por servicio</b>${bars(metrics.byService)}</div></div>
<h2>Seguimiento (pestaña de la hoja)</h2>
<div class="tablewrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
<h2>Correo del reporte semanal</h2>
<div class="report">${report}</div>
</main></body></html>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--now");
  const demo = buildDemo(i !== -1 ? { now: new Date(process.argv[i + 1]) } : {});
  const out = path.join(DIR, "..", "out");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, "panel-demo.html");
  fs.writeFileSync(file, renderPage(demo));
  console.log(`Panel de demostración: ${path.relative(process.cwd(), file)}`);
}
