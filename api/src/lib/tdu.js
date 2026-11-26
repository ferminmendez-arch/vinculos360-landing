/* =========================================================
   COMPAÑÍA DE DISTRIBUCIÓN (TDU) POR ZIP — Texas
   Consulta el servicio público de Power to Choose (PUCT) para saber
   qué compañía de distribución atiende un ZIP. Las tarifas de
   electricidad cambian por distribuidora, así que el agente de leads
   usa este dato para comparar con la pestaña "Tarifas".
   Si la consulta falla o tarda, el lead se guarda igual, sin este dato.
========================================================= */

export const PTC_ENDPOINT = "https://www.powertochoose.org/en-us/service/v1/";

const SHORT_NAMES = [
  [/centerpoint/i, "CenterPoint"],
  [/oncor/i, "Oncor"],
  [/aep texas central/i, "AEP Central"],
  [/aep texas north/i, "AEP North"],
  [/texas.new mexico/i, "TNMP"],
  [/lubbock/i, "Lubbock"],
];

export function tduShortName(name) {
  const hit = SHORT_NAMES.find(([re]) => re.test(String(name || "")));
  return hit ? hit[1] : String(name || "").trim();
}

/* Lista de distribuidoras (nombres cortos, sin repetir) en la respuesta de Power to Choose. */
export function tdusFromPlans(plans) {
  if (!Array.isArray(plans)) return [];
  return [...new Set(plans.map((p) => tduShortName(p && p.company_tdu_name)).filter(Boolean))];
}

const cache = new Map();

export async function lookupTdu(zip, { fetchImpl = fetch, timeoutMs = 3500 } = {}) {
  if (!/^\d{5}$/.test(String(zip))) return "";
  if (cache.has(zip)) return cache.get(zip);
  try {
    const res = await fetchImpl(PTC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ method: "plans", zip_code: zip, estimated_use: 1000, include_details: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return "";
    const tdus = tdusFromPlans(await res.json());
    const value = tdus.join(" o ");
    if (cache.size > 2000) cache.clear();
    cache.set(zip, value);
    return value;
  } catch {
    return "";
  }
}
