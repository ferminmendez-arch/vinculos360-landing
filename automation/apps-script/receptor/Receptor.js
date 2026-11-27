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

   v5 (correo de confirmación, aprobado por el dueño el 27 nov 2026): si el
   lead trae un correo válido y consentimiento, después de guardar la fila
   se envía un correo de confirmación desde la cuenta del dueño. Nunca
   bloquea ni cambia la respuesta del lead si el correo falla. Máximo uno
   por dirección cada 6 h. Se apaga con la propiedad
   CONFIRMATION_EMAIL_ENABLED = false. Las respuestas del cliente van a
   fermin.mendez@vinculos360.com (Reply-To; propiedad CONFIRMATION_REPLY_TO).
   Con las propiedades MS_* configuradas, el correo sale directamente del
   buzón del negocio en Microsoft 365 (ver docs/CORREO-DOMINIO.md).

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
  WHATSAPP: "12818257327",
  PHONE_DISPLAY: "(281) 825-7327",
  SITE: "www.vinculos360.com",
  // Las respuestas del cliente llegan al correo del negocio (Microsoft 365). El envío sale de la
  // cuenta de Google del script porque el SPF/DMARC de vinculos360.com solo autoriza a Microsoft.
  REPLY_TO: "fermin.mendez@vinculos360.com",
  FROM_NAME: "Fermín Mendez · Vínculos 360",
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

/* ---------- Correo de confirmación al cliente (v5) ---------- */

function receptorEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Arma el correo o devuelve null si no corresponde enviarlo. Función pura (probada). */
function receptorConfirmationEmail(data, lead) {
  var email = String((data && data.email) || "").trim().toLowerCase();
  if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(email) || email.length > 120) return null;
  var consent = data.consent === true || data.consent === "sí" || data.consent === "si";
  if (!consent) return null;
  var en = data.language === "en";
  var first = String(lead.name || "").split(" ")[0];
  var methodsEs = { whatsapp: "WhatsApp", llamada: "llamada", texto: "mensaje de texto", correo: "correo" };
  var methodsEn = { whatsapp: "WhatsApp", llamada: "phone call", texto: "text message", correo: "email" };
  var servicesEn = { "Electricidad": "electricity", "Internet": "internet", "Seguridad y monitoreo": "security and monitoring", "Televisión": "TV",
    "Telefonía celular": "cell phone service", "Protección de identidad": "identity protection", "Procesamiento de pagos": "payment processing", "Otros servicios": "other services" };
  var serviceEs = lead.service === "Electricidad" ? "energía eléctrica" : String(lead.service || "").toLowerCase();
  var reminder = data.channel === "recordatorio";
  var date = String(data.contractExpiration || "");
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  var monthsEs = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var dateText = m ? (en ? monthsEn[+m[2] - 1] + " " + +m[3] + ", " + m[1] : +m[3] + " de " + monthsEs[+m[2] - 1] + " de " + m[1]) : "";
  var wa = "https://wa.me/" + RECEPTOR.WHATSAPP;
  var lines;
  if (en) {
    lines = [
      "Hi " + first + ",",
      reminder && dateText
        ? "Thanks! Your reminder is set: we'll message you on WhatsApp before your electricity contract ends on " + dateText + ", so you can compare in time."
        : "Thanks for reaching out. We received your request about " + (servicesEn[lead.service] || "your service") + " (ZIP " + lead.zipCode + "). Fermín will contact you soon by " + (methodsEn[data.preferredContact] || "phone") + ".",
      reminder ? "" : "To save time, have your latest bill handy (the total and the kWh).",
      "Important: we will never ask for your Social Security number or ID by email, WhatsApp or chat.",
      "Want to talk now? Message us on WhatsApp: " + wa + " or call " + RECEPTOR.PHONE_DISPLAY + ".",
      "If you didn't make this request or don't want more messages, reply to this email with \"NO\".",
    ];
  } else {
    lines = [
      "Hola " + first + ",",
      reminder && dateText
        ? "¡Gracias! Tu recordatorio quedó listo: te escribiremos por WhatsApp antes de que venza tu contrato de energía eléctrica, el " + dateText + ", para que compares a tiempo."
        : "Gracias por escribirnos. Recibimos tu solicitud sobre " + serviceEs + " (ZIP " + lead.zipCode + "). Fermín te contactará pronto por " + (methodsEs[data.preferredContact] || "teléfono") + ".",
      reminder ? "" : "Para ganar tiempo, ten a mano tu última factura (el total y los kWh).",
      "Importante: nunca te pediremos tu número de Seguro Social ni tu identificación por correo, WhatsApp o chat.",
      "¿Prefieres hablar ya? Escríbenos por WhatsApp: " + wa + " o llama al " + RECEPTOR.PHONE_DISPLAY + ".",
      "Si no hiciste esta solicitud o no quieres más mensajes, responde a este correo con \"NO\".",
    ];
  }
  lines = lines.filter(Boolean);
  var signature = en
    ? ["Fermín Mendez · Vínculos 360 · Houston, TX", RECEPTOR.REPLY_TO + " · " + RECEPTOR.SITE, "We are independent representatives."]
    : ["Fermín Mendez · Vínculos 360 · Houston, TX", RECEPTOR.REPLY_TO + " · " + RECEPTOR.SITE, "Somos representantes independientes."];
  var subject = en
    ? (reminder ? "Your contract reminder is set — Vínculos 360" : "We received your request — Vínculos 360")
    : (reminder ? "Tu recordatorio quedó listo — Vínculos 360" : "Recibimos tu solicitud — Vínculos 360");
  var html = "<div style=\"font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;max-width:560px\">" +
    lines.map(function (l) { return "<p>" + receptorEsc(l).replace(receptorEsc(wa), "<a href=\"" + wa + "\">" + receptorEsc(wa) + "</a>") + "</p>"; }).join("") +
    "<p style=\"color:#475569;font-size:13px;margin-top:24px\">" + signature.map(receptorEsc).join("<br>") + "</p></div>";
  return { to: email, subject: subject, body: lines.concat(["", ""], signature).join("\n\n"), htmlBody: html, name: RECEPTOR.FROM_NAME, replyTo: RECEPTOR.REPLY_TO };
}

/* ---------- Envío desde fermin.mendez@vinculos360.com (Microsoft 365) ----------
   Si existen las propiedades MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET y
   MS_SENDER, el correo sale del buzón del negocio con Microsoft Graph
   (permiso de aplicación Mail.Send). Así pasa SPF/DKIM/DMARC del dominio.
   Si faltan o Graph falla, se usa la cuenta de Google con Reply-To al negocio.
   El secreto solo vive en las propiedades del script: nunca en el código. */

function receptorGraphConfig() {
  var p = PropertiesService.getScriptProperties();
  var c = { tenant: p.getProperty("MS_TENANT_ID"), client: p.getProperty("MS_CLIENT_ID"), secret: p.getProperty("MS_CLIENT_SECRET"), sender: p.getProperty("MS_SENDER") };
  return c.tenant && c.client && c.secret && c.sender ? c : null;
}

/* Cuerpo JSON para POST /users/{sender}/sendMail. Función pura (probada). */
function receptorGraphMessage(msg) {
  return {
    message: {
      subject: msg.subject,
      body: { contentType: "HTML", content: msg.htmlBody },
      toRecipients: [{ emailAddress: { address: msg.to } }],
      replyTo: msg.replyTo ? [{ emailAddress: { address: msg.replyTo } }] : [],
    },
    saveToSentItems: true,
  };
}

function receptorGraphToken(cfg) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("ms_token");
  if (cached) return cached;
  var res = UrlFetchApp.fetch("https://login.microsoftonline.com/" + encodeURIComponent(cfg.tenant) + "/oauth2/v2.0/token", {
    method: "post",
    payload: { client_id: cfg.client, client_secret: cfg.secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("token " + res.getResponseCode());
  var json = JSON.parse(res.getContentText());
  cache.put("ms_token", json.access_token, Math.max(60, Math.min(3000, (json.expires_in || 3600) - 300)));
  return json.access_token;
}

function receptorSendViaGraph(cfg, msg) {
  var res = UrlFetchApp.fetch("https://graph.microsoft.com/v1.0/users/" + encodeURIComponent(cfg.sender) + "/sendMail", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + receptorGraphToken(cfg) },
    payload: JSON.stringify(receptorGraphMessage(msg)),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 202) throw new Error("sendMail " + res.getResponseCode());
}

/* Envía la confirmación sin afectar nunca el resultado del lead. */
function receptorSendConfirmation(data, lead) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (String(props.getProperty("CONFIRMATION_EMAIL_ENABLED") || "true") === "false") return "off";
    var msg = receptorConfirmationEmail(data, lead);
    if (!msg) return "skip";
    var replyTo = props.getProperty("CONFIRMATION_REPLY_TO");
    if (replyTo) msg.replyTo = replyTo;
    var cache = CacheService.getScriptCache();
    var key = "conf:" + msg.to;
    if (cache.get(key)) return "recent";
    var via = "google";
    var cfg = receptorGraphConfig();
    if (cfg) {
      try {
        receptorSendViaGraph(cfg, msg);
        via = "microsoft";
      } catch (graphError) {
        console.error("Graph: " + (graphError && graphError.message ? graphError.message : graphError) + " — se usa la cuenta de Google");
      }
    }
    if (via === "google") {
      if (MailApp.getRemainingDailyQuota() < 5) return "quota";
      MailApp.sendEmail(msg);
    }
    cache.put(key, "1", 21600); // 6 h (máximo de CacheService)
    return "sent:" + via;
  } catch (e) {
    console.error("confirmación: " + (e && e.message ? e.message : e));
    return "error";
  }
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
    try {
      lock.releaseLock();
    } catch (releaseError) {
      /* ya liberado */
    }
    receptorSendConfirmation(data, l); // después de guardar; nunca cambia la respuesta
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
