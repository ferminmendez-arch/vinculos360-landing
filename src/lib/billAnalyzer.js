/* =========================================================
   ANALIZADOR DE FACTURA DE ENERGÍA ELÉCTRICA (lógica pura)

   Calcula el costo promedio efectivo por kWh de la factura del
   visitante y lo compara con el promedio residencial de Texas (EIA).
   No usa tarifas de ningún proveedor ni promete ahorros: la
   comparación con planes reales la hace una persona después,
   con la solicitud de revisión personalizada.

   Todo se calcula en el navegador. Nada se envía hasta que el
   visitante pide la comparación y completa el chat con su
   consentimiento.
========================================================= */

import {
  QUESTIONS,
  TX_RESIDENTIAL_AVG,
  checkZip,
  compareToAverage,
  contractStatus,
  digitsOnly,
  effectiveCents,
  isLikelyNoChoiceZip,
  isTexasZip,
  parseAmount,
  parseContractEnd,
} from "../../api/src/lib/rules.js";

export { TX_RESIDENTIAL_AVG };

const BILL = QUESTIONS.electricidad.find((q) => q.id === "bill");
const KWH = QUESTIONS.electricidad.find((q) => q.id === "kwh");

/* Valida lo que escribió el visitante. Devuelve { values } o { errors: { campo: código } }. */
export function validateAnalyzerInput({ bill, kwh, zipCode, contractEnd }, today = new Date()) {
  const errors = {};
  const b = parseAmount(bill);
  if (!String(bill ?? "").trim()) errors.bill = "bill_required";
  else if (b === null) errors.bill = "number_invalid";
  else if (Number(b) < BILL.min) errors.bill = "bill_low";
  else if (Number(b) > BILL.max) errors.bill = "bill_high";

  const k = parseAmount(kwh);
  if (!String(kwh ?? "").trim()) errors.kwh = "kwh_required";
  else if (k === null) errors.kwh = "number_invalid";
  else if (Number(k) < KWH.min) errors.kwh = "kwh_low";
  else if (Number(k) > KWH.max) errors.kwh = "kwh_high";

  const zipError = checkZip(zipCode);
  if (zipError) errors.zipCode = zipError;

  const end = String(contractEnd ?? "").trim();
  if (end && !parseContractEnd(end, today)) errors.contractEnd = "date_invalid";

  if (!errors.bill && !errors.kwh && effectiveCents(b, k) === null) errors.kwh = "rate_out_of_range";

  if (Object.keys(errors).length) return { errors };
  return { values: { bill: b, kwh: k, zipCode: digitsOnly(zipCode), contractEnd: end ? parseContractEnd(end, today) : "" } };
}

/* Resultado completo para mostrar. Solo se llama con valores ya validados. */
export function analyzeBill({ bill, kwh, zipCode, contractEnd }, today = new Date()) {
  const cents = effectiveCents(bill, kwh);
  const comparison = compareToAverage(cents);
  const texas = isTexasZip(zipCode);
  return {
    cents,
    comparison,
    zone: !texas ? "fuera_de_texas" : isLikelyNoChoiceZip(zipCode) ? "sin_opcion_probable" : "texas",
    contract: contractStatus(contractEnd, today),
  };
}
