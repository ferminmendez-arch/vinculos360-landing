/* Prueba de humo en CI: carga el registro de funciones con el paquete
   real @azure/functions (fuera del host queda en "modo de prueba") y
   ejecuta /api/health a través de la lógica real. */
import { handleHealth } from "../src/lib/handlers.js";

await import("../src/functions/api.js");
const res = handleHealth({ env: {} });
if (res.status !== 200 || res.jsonBody.ok !== true || res.jsonBody.sinks.sheet !== true) {
  console.error("Smoke test falló", res);
  process.exit(1);
}
console.log("API OK: funciones registradas y health responde", JSON.stringify(res.jsonBody));
