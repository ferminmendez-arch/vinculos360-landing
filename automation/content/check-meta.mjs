/* =========================================================
   Verificación de la conexión con Meta — NO publica nada.
   Usa la clave guardada para obtener el token de la página y lee
   solo el nombre y el ID de la página. Nunca imprime claves.

   Uso (en GitHub Actions, entorno "facebook"):
   node automation/content/check-meta.mjs
========================================================= */

import fs from "node:fs";
import { readConfig, resolvePageToken } from "./publish-meta.mjs";

const config = readConfig(process.env);
const lines = [];
const report = (ok, message) => {
  lines.push(`${ok ? "✅" : "❌"} ${message}`);
  console.log(`${ok ? "OK" : "ERROR"}: ${message}`);
};

try {
  if (!config.pageId) throw new Error("Falta META_PAGE_ID.");
  if (!config.token) throw new Error("Falta META_PAGE_TOKEN.");
  report(true, "Las claves META_PAGE_ID y META_PAGE_TOKEN existen.");

  const pageToken = await resolvePageToken(config);
  report(true, "Meta entregó el token de la página.");

  const url = `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.pageId)}?fields=id,name`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${pageToken}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) throw new Error(`Meta respondió ${res.status}: ${json.error?.message || "sin detalle"}`);
  report(json.id === config.pageId, `Página: "${json.name}" (ID ${json.id}).`);
  report(true, `Publicación automática: ${config.enabled ? "ACTIVADA" : "desactivada (META_PUBLISH_ENABLED no es \"true\")"}.`);
} catch (error) {
  report(false, error.message);
  process.exitCode = 1;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, ["### Verificación de Meta (no publica nada)", "", ...lines, ""].join("\n"));
}
