/* =========================================================
   MÉTRICAS DEL CHATBOT DESDE AZURE TABLE STORAGE (opcional)

   Solo aplica si se aprobó y configuró Azure Storage. Se ejecuta en
   la computadora del dueño (no se despliega) con una URL SAS de
   SOLO LECTURA ("sp=r") de la tabla de eventos:

     EVENTS_READ_SAS_URL="https://<cuenta>.table.core.windows.net/chatevents?sv=...&sp=r&sig=..." \
       node automation/chatbot/metrics.mjs 30

   Imprime, por día, aperturas, conversaciones iniciadas, solicitudes
   completadas y precalificadas, más la conversión. Sin datos personales.
   Sin Azure Storage, las mismas cifras están en la pestaña "Chatbot"
   de la hoja (receptor v2 con CHAT_EVENTS_TO_SHEET=true).
========================================================= */

const EVENTS = ["chat_open", "chat_start", "chat_complete", "chat_qualified"];

export function summarize(entities) {
  const byDay = {};
  for (const e of entities) {
    if (!EVENTS.includes(e.Event)) continue;
    const day = (byDay[e.PartitionKey] ||= Object.fromEntries(EVENTS.map((k) => [k, 0])));
    day[e.Event] += 1;
  }
  const totals = Object.fromEntries(EVENTS.map((k) => [k, 0]));
  for (const d of Object.values(byDay)) for (const k of EVENTS) totals[k] += d[k];
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "-");
  return {
    byDay,
    totals,
    conversion: {
      startPerOpen: pct(totals.chat_start, totals.chat_open),
      completePerStart: pct(totals.chat_complete, totals.chat_start),
      qualifiedPerComplete: pct(totals.chat_qualified, totals.chat_complete),
    },
  };
}

async function fetchAll(sasUrl, sinceDay) {
  const out = [];
  let next = null;
  do {
    const url = new URL(sasUrl);
    url.searchParams.set("$filter", `PartitionKey ge '${sinceDay}'`);
    url.searchParams.set("$select", "PartitionKey,Event");
    if (next) {
      url.searchParams.set("NextPartitionKey", next.pk);
      if (next.rk) url.searchParams.set("NextRowKey", next.rk);
    }
    const res = await fetch(url, { headers: { Accept: "application/json;odata=nometadata", "x-ms-version": "2019-02-02" } });
    if (!res.ok) throw new Error(`Table Storage respondió ${res.status}`);
    out.push(...(await res.json()).value);
    const pk = res.headers.get("x-ms-continuation-NextPartitionKey");
    next = pk ? { pk, rk: res.headers.get("x-ms-continuation-NextRowKey") } : null;
  } while (next);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sas = process.env.EVENTS_READ_SAS_URL;
  if (!sas) {
    console.error("Falta EVENTS_READ_SAS_URL (URL SAS de solo lectura de la tabla de eventos).");
    process.exit(1);
  }
  const days = Number(process.argv[2] || 30);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const report = summarize(await fetchAll(sas, since));
  console.table(report.byDay);
  console.log("Totales:", report.totals);
  console.log("Conversión:", report.conversion);
}
