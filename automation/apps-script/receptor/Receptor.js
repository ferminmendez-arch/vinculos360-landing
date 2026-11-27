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

   v4 (analizador de factura, compatible con v1–v3): columnas BillAmount,
   MonthlyKwh, EffectiveCentsKwh, ContractExpiration y LeadSource al final,
   y contadores analyzer_view / analyzer_calc / analyzer_cta / analyzer_share /
   reminder_signup en "Chatbot". Canal "recordatorio" = recordatorio de vencimiento.

   v2 (chatbot, compatible con v1): si el cuerpo trae claves extra del
   chatbot (channel, language, email, preferredContact, consent,
   consentVersion, consentAt, qualification, answers, chatLeadId), se
   guardan en columnas nuevas A LA DERECHA de LeadId. Las 12 columnas
   originales no cambian de lugar, así que el agente de leads sigue
   funcionando igual. Con {"type":"chat_event"} suma métricas anónimas
   del chatbot por día en la pestaña "Chatbot" (sin datos personales).

   Instalación: proyecto de Apps Script vinculado a la hoja
   (Extensiones → Apps Script) o independiente con la propiedad del
   script SPREADSHEET_ID. Pegar este archivo, ejecutar setupLeadsSheet()
   una vez y luego
   Implementar → Nueva implementación → Aplicación web
   (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
========================================================= */

var RECEPTOR = {
  SHEET: "Leads",
  HEADERS: ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device", "LeadId"],
  // v4 (analizador de factura): BillAmount … LeadSource al final. Las anteriores no se mueven.
  EXTRA_HEADERS: ["Channel", "Language", "Email", "PreferredContact", "Consent", "ConsentVersion", "ConsentAt", "Qualification", "Answers", "ChatLeadId",
    "BillAmount", "MonthlyKwh", "EffectiveCentsKwh", "ContractExpiration", "LeadSource"],
  EXTRA_KEYS: ["channel", "language", "email", "preferredContact", "consent", "consentVersion", "consentAt", "qualification", "answers", "chatLeadId",
    "billAmount", "monthlyKwh", "effectiveCentsKwh", "contractExpiration", "leadSource"],
  METRICS_SHEET: "Chatbot",
  METRICS_HEADERS: ["Fecha", "chat_open", "chat_start", "chat_complete", "chat_qualified", "analyzer_view", "analyzer_calc", "analyzer_cta", "analyzer_share", "reminder_signup"],
  SERVICES: ["Electricidad", "Internet", "Seguridad y monitoreo", "Televisión", "Telefonía celular", "Protección de identidad", "Procesamiento de pagos", "Otros servicios"],
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
      extras: RECEPTOR.EXTRA_KEYS.map(function (k) {
        if (k === "channel") return data.channel || "formulario";
        return data[k] == null ? "" : data[k];
      }),
    },
  };
}

function receptorSpreadsheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Falta la propiedad SPREADSHEET_ID.");
  return SpreadsheetApp.openById(id);
}

/* Devuelve { sheet, extended }. `extended` indica si la pestaña tiene
   las columnas del chatbot (v2). Solo se agregan si la fila de
   encabezados empieza exactamente con las 12 columnas originales;
   una pestaña con otro formato no se toca. */
function receptorSheet() {
  var ss = receptorSpreadsheet();
  var sheet = ss.getSheetByName(RECEPTOR.SHEET);
  if (!sheet) sheet = ss.insertSheet(RECEPTOR.SHEET);
  var all = RECEPTOR.HEADERS.concat(RECEPTOR.EXTRA_HEADERS);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, all.length).setValues([all]);
    sheet.setFrozenRows(1);
    return { sheet: sheet, extended: true };
  }
  var width = Math.max(sheet.getLastColumn(), RECEPTOR.HEADERS.length);
  var header = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h); });
  for (var i = 0; i < RECEPTOR.HEADERS.length; i++) {
    if (header[i] !== RECEPTOR.HEADERS[i]) return { sheet: sheet, extended: false };
  }
  var extra = header.slice(RECEPTOR.HEADERS.length, all.length);
  var complete = RECEPTOR.EXTRA_HEADERS.every(function (h, j) { return extra[j] === h; });
  if (complete) return { sheet: sheet, extended: true };
  var free = RECEPTOR.EXTRA_HEADERS.every(function (h, j) { return !extra[j] || extra[j] === h; });
  if (!free) return { sheet: sheet, extended: false };
  sheet.getRange(1, RECEPTOR.HEADERS.length + 1, 1, RECEPTOR.EXTRA_HEADERS.length).setValues([RECEPTOR.EXTRA_HEADERS]);
  return { sheet: sheet, extended: true };
}

/* ---------- Métricas del chatbot (anónimas) ---------- */

function receptorMetricsSheet() {
  var ss = receptorSpreadsheet();
  var sheet = ss.getSheetByName(RECEPTOR.METRICS_SHEET);
  if (!sheet) sheet = ss.insertSheet(RECEPTOR.METRICS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RECEPTOR.METRICS_HEADERS.length).setValues([RECEPTOR.METRICS_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  // v4: agrega los encabezados nuevos a la derecha si faltan (sin mover los existentes).
  var current = sheet.getRange(1, 1, 1, RECEPTOR.METRICS_HEADERS.length).getValues()[0].map(function (h) { return String(h); });
  var compatible = RECEPTOR.METRICS_HEADERS.every(function (h, i) { return !current[i] || current[i] === h; });
  var missing = RECEPTOR.METRICS_HEADERS.some(function (h, i) { return current[i] !== h; });
  if (compatible && missing) sheet.getRange(1, 1, 1, RECEPTOR.METRICS_HEADERS.length).setValues([RECEPTOR.METRICS_HEADERS]);
  return sheet;
}

function receptorDay(date) {
  return Utilities.formatDate(date, "America/Chicago", "yyyy-MM-dd");
}

/* Suma 1 al contador del evento en la fila de hoy (crea la fila si falta). */
function receptorCountEvent(eventName) {
  var col = RECEPTOR.METRICS_HEADERS.indexOf(eventName);
  if (col < 1) return { ok: false, result: "error", reason: "invalid_event" };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, result: "error", reason: "busy" };
  try {
    var sheet = receptorMetricsSheet();
    var today = receptorDay(new Date());
    var last = sheet.getLastRow();
    var row = null;
    if (last > 1) {
      var values = sheet.getRange(last, 1, 1, RECEPTOR.METRICS_HEADERS.length).getValues()[0];
      var lastDay = values[0] instanceof Date ? receptorDay(values[0]) : String(values[0]).replace(/^'/, "");
      if (lastDay === today) row = values;
    }
    if (row) {
      row[col] = (Number(row[col]) || 0) + 1;
      sheet.getRange(last, 1, 1, row.length).setValues([row]);
    } else {
      var fresh = RECEPTOR.METRICS_HEADERS.map(function (h, i) { return i === 0 ? "'" + today : 0; });
      fresh[col] = 1;
      sheet.appendRow(fresh);
    }
    return { ok: true, result: "success" };
  } finally {
    lock.releaseLock();
  }
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

    if (data && data.type === "chat_event") {
      return receptorJson(receptorCountEvent(String(data.event || "")));
    }

    var checked = receptorValidate(data);
    if (checked.error) return receptorJson({ ok: false, result: "error", reason: checked.error });
    var l = checked.lead;

    if (!lock.tryLock(20000)) return receptorJson({ ok: false, result: "error", reason: "busy" });
    var leadId = Utilities.getUuid();
    var target = receptorSheet();
    var values = [l.name, l.phone, l.zipCode, l.service, l.source, l.medium, l.campaign, l.ad, l.fbclid, l.device, leadId];
    if (target.extended) values = values.concat(l.extras);
    var row = [new Date()].concat(values.map(receptorSafe));
    target.sheet.appendRow(row);
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
  var target = receptorSheet();
  receptorMetricsSheet();
  var n = RECEPTOR.HEADERS.length + (target.extended ? RECEPTOR.EXTRA_HEADERS.length : 0);
  return "Pestaña " + target.sheet.getName() + " lista con " + n + " columnas.";
}
