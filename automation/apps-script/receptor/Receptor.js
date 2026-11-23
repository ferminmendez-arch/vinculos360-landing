/* =========================================================
   VÍNCULOS 360 — RECEPTOR DE LEADS (Google Apps Script, Web App)

   Recibe el formulario del sitio y guarda cada lead en la pestaña
   "Leads" de la hoja a la que está vinculado este script.

   Contrato con el sitio (src/lib/leads.js), sin cambios:
   - POST con cuerpo JSON (Content-Type text/plain) y las claves
     name, phone, zipCode, service, source, medium, campaign, ad,
     fbclid, device.
   - Responde JSON. {"ok":true,"result":"success"} solo DESPUÉS de
     escribir la fila. Si algo falla responde {"ok":false,...}: el sitio
     no abre WhatsApp como si estuviera guardado y reintenta después.

   Instalación: Extensiones → Apps Script desde la hoja, pegar este
   archivo, ejecutar setupLeadsSheet() una vez y luego
   Implementar → Nueva implementación → Aplicación web
   (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
========================================================= */

var RECEPTOR = {
  SHEET: "Leads",
  HEADERS: ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId"],
  SERVICES: ["Electricidad", "Internet", "Seguridad y monitoreo", "Otros servicios"],
  MAX_BODY: 5000,
  MAX_FIELD: 300,
};

function receptorJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Evita que un texto como "=IMPORTXML(...)" se ejecute como fórmula. */
function receptorSafe(value) {
  var s = String(value == null ? "" : value).replace(/[\t\r\n\v\f]/g, " ").trim().slice(0, RECEPTOR.MAX_FIELD);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* Valida y normaliza el lead. Devuelve { lead } o { error }. */
function receptorValidate(data) {
  if (!data || typeof data !== "object") return { error: "invalid_body" };
  var name = String(data.name || "").replace(/\s+/g, " ").trim();
  var digits = String(data.phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
  var zip = String(data.zipCode || "").replace(/\D/g, "");
  var service = String(data.service || "").trim();

  if (name.length < 2 || name.length > 80) return { error: "invalid_name" };
  if (digits.length !== 10) return { error: "invalid_phone" };
  if (zip.length !== 5) return { error: "invalid_zip" };
  if (RECEPTOR.SERVICES.indexOf(service) === -1) return { error: "invalid_service" };

  return {
    lead: {
      name: name,
      phone: "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6),
      zipCode: zip,
      service: service,
      source: data.source || "",
      medium: data.medium || "",
      campaign: data.campaign || "",
      ad: data.ad || "",
      fbclid: data.fbclid || "",
      device: data.device || "",
    },
  };
}

function receptorSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(RECEPTOR.SHEET);
  if (!sheet) sheet = ss.insertSheet(RECEPTOR.SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RECEPTOR.HEADERS.length).setValues([RECEPTOR.HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = e && e.postData && e.postData.contents ? e.postData.contents : "";
    if (!body || body.length > RECEPTOR.MAX_BODY) return receptorJson({ ok: false, result: "error", reason: "invalid_body" });

    var data;
    try {
      data = JSON.parse(body);
    } catch (parseError) {
      return receptorJson({ ok: false, result: "error", reason: "invalid_json" });
    }

    var checked = receptorValidate(data);
    if (checked.error) return receptorJson({ ok: false, result: "error", reason: checked.error });
    var l = checked.lead;

    if (!lock.tryLock(20000)) return receptorJson({ ok: false, result: "error", reason: "busy" });
    var leadId = Utilities.getUuid();
    var row = [new Date()].concat(
      [l.name, l.phone, l.zipCode, l.service, l.source, l.medium, l.campaign, l.ad, l.fbclid, l.device, leadId].map(receptorSafe)
    );
    receptorSheet().appendRow(row);
    SpreadsheetApp.flush(); // la fila queda escrita antes de confirmar
    return receptorJson({ ok: true, result: "success", id: leadId });
  } catch (error) {
    console.error("doPost: " + (error && error.message ? error.message : error));
    return receptorJson({ ok: false, result: "error", reason: "server_error" });
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseError) {
      /* no tenía el candado */
    }
  }
}

/* Verificación de salud: no devuelve datos. */
function doGet() {
  return receptorJson({ ok: true, service: "vinculos360-leads" });
}

/* Ejecutar una vez desde el editor: crea la pestaña Leads con sus encabezados. */
function setupLeadsSheet() {
  var sheet = receptorSheet();
  return "Pestaña " + sheet.getName() + " lista con " + RECEPTOR.HEADERS.length + " columnas.";
}
