/* =========================================================
   VÍNCULOS 360 — AGENTE 2 (GESTIÓN DE LEADS) Y AGENTE 3 (ANALÍTICA)

   Proyecto de Apps Script INDEPENDIENTE del script de producción que
   recibe el formulario. No modifica ese script ni la pestaña "Leads":
   solo la LEE. Escribe únicamente en sus propias pestañas:

     Seguimiento  – una fila por lead nuevo: clasificación, duplicados,
                    borrador de WhatsApp y estado (lo cambia el dueño).
     Panel        – métricas actuales y avance hacia la meta.
     Semanal      – historial de reportes semanales.
     Gastos       – el dueño anota aquí el gasto en anuncios.
     Registro     – bitácora técnica sin datos personales.

   Nunca envía mensajes a clientes. Solo prepara borradores y un enlace
   wa.me que una persona abre y envía manualmente. Los correos de aviso
   van únicamente al dueño.

   Funciones para usar desde el editor de Apps Script:
     setup()             – crea pestañas y activadores (una vez).
     processNewLeads()   – revisa leads nuevos (cada 15 min).
     sendWeeklyReport()  – reporte semanal por correo (lunes 8 a. m.).
     runSelfTest()       – prueba con datos ficticios, sin tocar la hoja.

   Propiedades del script (Configuración del proyecto → Propiedades):
     SPREADSHEET_ID   (obligatoria) ID de la hoja de Google con "Leads".
     OWNER_EMAIL      correo del dueño para avisos (por defecto, la cuenta
                      que ejecuta el script).
     GOAL_START       AAAA-MM-DD inicio de la meta de 30 días.
     GOAL_QUALIFIED   meta de leads calificados (por defecto 10).
     GOAL_DAYS        duración de la meta (por defecto 30).
     BUDGET_CAP_USD   tope de gasto (por defecto 50).
     ALERT_DETAILS    "true" para incluir nombre y servicio en el aviso.
========================================================= */

var V360 = {
  SHEETS: { leads: "Leads", tracking: "Seguimiento", panel: "Panel", weekly: "Semanal", spend: "Gastos", log: "Registro", tariffs: "Tarifas" },
  WHATSAPP_BUSINESS: "12818257327",
  DUPLICATE_WINDOW_DAYS: 30,
  LOG_MAX_ROWS: 1000,
  FAILURE_ALERT_EVERY_HOURS: 6,
  TRACKING_HEADERS: [
    "Clave", "Recibido", "Nombre", "Teléfono", "ZIP", "Servicio", "Origen", "Medio", "Campaña",
    "Contenido/anuncio", "Prioridad", "Clasificación", "Motivo", "Duplicado de", "Estado",
    "Próximo paso", "Notas", "Borrador WhatsApp", "Abrir WhatsApp", "Agregado",
    // Comparación de electricidad y paso de inscripción (nov. 2026). Van al final para no mover columnas.
    "Distribuidora", "Precio actual (¢/kWh)", "Plan sugerido", "Precio plan (¢/kWh)", "Diferencia estimada ($/mes)",
    "Mensaje inscripción", "Abrir WhatsApp (inscripción)",
  ],
  /* Pestaña privada que llena el dueño con las tarifas de su proveedor por distribuidora
     (precio promedio de la hoja de datos/EFL a 500, 1,000 y 2,000 kWh, en centavos). */
  TARIFF_HEADERS: ["Distribuidora", "Plan", "Plazo (meses)", "¢/kWh a 500", "¢/kWh a 1000", "¢/kWh a 2000", "Actualizado", "Notas"],
  TDUS: ["CenterPoint", "Oncor", "AEP Central", "AEP North", "TNMP", "Lubbock"],
  /* Enlace oficial de inscripción con el ID de IBO (propiedad ENROLL_URL_ELECTRICIDAD para cambiarlo). */
  ENROLL_URL_ELECTRICIDAD: "https://acn.xoomenergy.com/en/?p=04893385",
  IBO_ID: "04893385",
  SPEND_HEADERS: ["Fecha", "Plataforma", "Campaña", "Monto USD", "Nota"],
  WEEKLY_HEADERS: ["Semana que termina", "Leads válidos", "Electricidad TX", "Calificados", "Gasto USD", "Costo por lead", "Costo por calificado"],
  STATUSES: ["Nuevo", "Contactado", "Calificado", "Inscripción en proceso", "Inscrito", "No calificado", "Cliente", "Sin respuesta", "No contactar", "Duplicado", "Prueba"],
  QUALIFIED_STATUSES: ["Calificado", "Inscripción en proceso", "Inscrito", "Cliente"],
  ENROLLED_STATUSES: ["Inscrito", "Cliente"],
  /* Prefijos de ZIP donde la mayoría del área NO tiene opción de proveedor:
     Austin (787), San Antonio (782), El Paso (798, 799). Solo marca "verificar". */
  NO_CHOICE_ZIP_PREFIXES: ["782", "787", "798", "799"],
  FIELD_ALIASES: {
    timestamp: ["timestamp", "fecha", "date", "marca temporal", "fecha y hora", "created", "createdat", "hora"],
    name: ["name", "nombre", "nombre completo"],
    phone: ["phone", "telefono", "teléfono", "celular", "tel"],
    zipCode: ["zipcode", "zip", "zip code", "codigo postal", "código postal"],
    service: ["service", "servicio"],
    source: ["source", "utm_source", "origen", "fuente"],
    medium: ["medium", "utm_medium", "medio"],
    campaign: ["campaign", "utm_campaign", "campaña", "campana"],
    ad: ["ad", "utm_content", "anuncio", "content", "contenido"],
    fbclid: ["fbclid"],
    device: ["device", "dispositivo"],
    answers: ["answers", "respuestas"],
  },
};

/* =========================================================
   NÚCLEO (funciones puras, probadas con node --test)
========================================================= */

function v360NormalizeHeader(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Devuelve { campo: índiceDeColumna }. Lanza error si faltan campos clave. */
function v360MapHeaders(headerRow) {
  var normalized = headerRow.map(v360NormalizeHeader);
  var map = {};
  Object.keys(V360.FIELD_ALIASES).forEach(function (field) {
    var aliases = V360.FIELD_ALIASES[field].map(v360NormalizeHeader);
    for (var i = 0; i < normalized.length; i++) {
      if (aliases.indexOf(normalized[i]) !== -1) {
        map[field] = i;
        break;
      }
    }
  });
  var missing = ["name", "phone", "service"].filter(function (f) { return map[f] === undefined; });
  if (missing.length) {
    throw new Error("La pestaña Leads no tiene las columnas esperadas: " + missing.join(", "));
  }
  return map;
}

function v360Digits(value) {
  return String(value == null ? "" : value).replace(/\D/g, "");
}

function v360NormalizePhone(value) {
  var d = v360Digits(value);
  if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
  return d;
}

function v360ToDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (value === "" || value == null) return null;
  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/* Convierte las filas de "Leads" en objetos. `values[0]` es el encabezado. */
function v360ReadLeads(values) {
  if (!values || values.length < 1) return [];
  var map = v360MapHeaders(values[0]);
  var get = function (row, field) {
    return map[field] === undefined ? "" : row[map[field]];
  };
  var leads = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return c === "" || c == null; })) continue;
    var ts = v360ToDate(get(row, "timestamp"));
    var phone = v360NormalizePhone(get(row, "phone"));
    var key = (ts ? ts.toISOString() : "fila" + (r + 1)) + "|" + phone;
    leads.push({
      key: key,
      rowNumber: r + 1,
      receivedAt: ts,
      name: String(get(row, "name") || "").replace(/\s+/g, " ").trim(),
      phone: phone,
      zip: v360Digits(get(row, "zipCode")).slice(0, 5),
      service: String(get(row, "service") || "").trim(),
      source: String(get(row, "source") || "").trim(),
      medium: String(get(row, "medium") || "").trim(),
      campaign: String(get(row, "campaign") || "").trim(),
      ad: String(get(row, "ad") || "").trim(),
      device: String(get(row, "device") || "").trim(),
      answers: v360ParseAnswers(get(row, "answers")),
    });
  }
  return leads;
}

function v360IsTexasZip(zip) {
  var p = parseInt(String(zip).slice(0, 3), 10);
  return /^\d{5}$/.test(zip) && ((p >= 750 && p <= 799) || p === 733 || p === 885);
}

function v360IsTest(lead) {
  return /\b(prueba|test|qa|demo)\b/i.test(lead.name) || /^\d{3}55501\d{2}$/.test(lead.phone);
}

/* Clasifica una lista de leads en orden cronológico. No usa datos externos. */
function v360ClassifyLeads(leads) {
  var windowMs = V360.DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  var seen = []; // leads válidos previos
  return leads.map(function (lead) {
    var out = Object.assign({}, lead, { priority: "", classification: "", reason: "", duplicateOf: "", status: "Nuevo" });

    if (v360IsTest(lead)) {
      out.classification = "Prueba";
      out.reason = "Nombre o teléfono de prueba";
      out.status = "Prueba";
      return out;
    }
    if (lead.phone.length !== 10) {
      out.priority = "C";
      out.classification = "Revisar datos";
      out.reason = "Teléfono incompleto o inválido";
      seen.push(lead);
      return out;
    }

    var previous = seen.filter(function (p) { return p.phone === lead.phone; });
    var sameService = previous.filter(function (p) {
      if (p.service !== lead.service) return false;
      if (!p.receivedAt || !lead.receivedAt) return true;
      return Math.abs(lead.receivedAt.getTime() - p.receivedAt.getTime()) <= windowMs;
    });
    if (sameService.length) {
      out.classification = "Duplicado";
      out.reason = "Mismo teléfono y servicio en " + V360.DUPLICATE_WINDOW_DAYS + " días";
      out.duplicateOf = sameService[sameService.length - 1].key;
      out.status = "Duplicado";
      return out;
    }
    var repeatNote = previous.length ? " · ya escribió antes por otro servicio" : "";

    if (/^electricidad$/i.test(lead.service)) {
      if (!/^\d{5}$/.test(lead.zip)) {
        out.priority = "C";
        out.classification = "Electricidad · revisar ZIP";
        out.reason = "ZIP inválido" + repeatNote;
      } else if (!v360IsTexasZip(lead.zip)) {
        out.priority = "C";
        out.classification = "Electricidad · fuera de Texas";
        out.reason = "El ZIP no es de Texas" + repeatNote;
      } else if (V360.NO_CHOICE_ZIP_PREFIXES.indexOf(lead.zip.slice(0, 3)) !== -1) {
        out.priority = "C";
        out.classification = "Electricidad · verificar área";
        out.reason = "ZIP en zona donde la mayoría no puede elegir proveedor (Austin, San Antonio o El Paso)" + repeatNote;
      } else {
        out.priority = "A";
        out.classification = "Electricidad · Texas";
        out.reason = "ZIP de Texas, área con opción probable (confirmar con la dirección)" + repeatNote;
      }
    } else if (lead.service) {
      out.priority = "B";
      out.classification = lead.service;
      out.reason = "Servicio distinto de electricidad" + repeatNote;
    } else {
      out.priority = "C";
      out.classification = "Revisar datos";
      out.reason = "Sin servicio seleccionado" + repeatNote;
    }
    seen.push(lead);
    return out;
  });
}

/* "bill=120; kwh=1000; distribuidora=CenterPoint" → { bill: "120", kwh: "1000", distribuidora: "CenterPoint" } */
function v360ParseAnswers(value) {
  var out = {};
  String(value == null ? "" : value).split(";").forEach(function (part) {
    var i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

function v360Num(value) {
  var n = Number(String(value == null ? "" : value).replace(/[$,¢c\s]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

/* Lee la pestaña Tarifas. Acepta precios en centavos (16.9) o en dólares (0.169). */
function v360ReadTariffs(values) {
  if (!values || values.length < 2) return [];
  var cents = function (v) {
    var n = v360Num(v);
    if (n === null) return null;
    return n < 1 ? n * 100 : n;
  };
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var tdu = String(row[0] || "").trim();
    var plan = String(row[1] || "").trim();
    if (!tdu || !plan) continue;
    var p = { tdu: tdu, plan: plan, term: v360Num(row[2]), p500: cents(row[3]), p1000: cents(row[4]), p2000: cents(row[5]) };
    if (p.p500 === null && p.p1000 === null && p.p2000 === null) continue;
    out.push(p);
  }
  return out;
}

/* Precio promedio del plan al consumo del cliente: interpola entre 500, 1,000 y 2,000 kWh. */
function v360PlanPriceAt(plan, kwh) {
  var pts = [[500, plan.p500], [1000, plan.p1000], [2000, plan.p2000]].filter(function (x) { return x[1] !== null; });
  if (!pts.length) return null;
  if (kwh <= pts[0][0]) return pts[0][1];
  for (var i = 1; i < pts.length; i++) {
    if (kwh <= pts[i][0]) {
      var a = pts[i - 1], b = pts[i];
      return a[1] + ((b[1] - a[1]) * (kwh - a[0])) / (b[0] - a[0]);
    }
  }
  return pts[pts.length - 1][1];
}

/* Compara lo que paga hoy el cliente con el plan más barato de su distribuidora en Tarifas.
   Devuelve {} si falta algún dato (distribuidora, factura, kWh o tarifa). */
function v360SuggestPlan(lead, tariffs) {
  var a = lead.answers || {};
  var out = { tdu: a.distribuidora || "" };
  if (!/^electricidad$/i.test(lead.service)) return {};
  var bill = v360Num(a.bill), kwh = v360Num(a.kwh);
  if (bill !== null && kwh !== null) {
    var current = (bill / kwh) * 100;
    if (current >= 5 && current <= 60) out.currentCents = Math.round(current * 10) / 10;
  }
  if (!out.tdu || out.tdu.indexOf(" o ") !== -1 || kwh === null) return out;
  var best = null;
  (tariffs || []).forEach(function (t) {
    if (t.tdu.toLowerCase() !== out.tdu.toLowerCase()) return;
    var price = v360PlanPriceAt(t, kwh);
    if (price !== null && (!best || price < best.price)) best = { plan: t, price: price };
  });
  if (!best) return out;
  out.planName = best.plan.plan + (best.plan.term ? " (" + best.plan.term + " meses)" : "");
  out.planCents = Math.round(best.price * 10) / 10;
  if (out.currentCents) out.monthlyDiff = Math.round(((out.currentCents - out.planCents) * kwh) / 100);
  return out;
}

/* Mensaje para que el CLIENTE se inscriba él mismo en el sitio oficial:
   así escribe su identificación y SSN directamente ahí y nadie más los ve. */
function v360EnrollmentDraft(lead, url, iboId) {
  var hi = v360FirstName(lead.name) ? "Hola " + v360FirstName(lead.name) : "Hola";
  return (
    hi + ", para completar tu inscripción de forma segura entra a este enlace oficial del proveedor: " + url + " . " +
    "Ahí mismo escribes tus datos personales (identificación y, si te lo piden, número de Seguro Social); " +
    "nosotros no los vemos ni los guardamos. Antes de confirmar, revisa la hoja de datos del plan (EFL). " +
    (iboId ? "Si te pide el número de representante, es " + iboId + ". " : "") +
    "Si tienes dudas, llámame y lo hacemos juntos por teléfono."
  );
}

function v360FirstName(name) {
  return String(name || "").split(" ")[0] || "";
}

/* Borrador para que una PERSONA lo revise y lo envíe. Incluye opción de no recibir más mensajes. */
function v360WhatsAppDraft(lead) {
  var hi = v360FirstName(lead.name) ? "Hola " + v360FirstName(lead.name) : "Hola";
  var service = lead.service ? String(lead.service).toLowerCase() : "tu servicio";
  var zip = lead.zip ? " en el ZIP " + lead.zip : "";
  return (
    hi + ", te saluda Vínculos 360. Recibimos tu solicitud sobre " + service + zip + ". " +
    "¿Es buen momento para hacerte unas preguntas rápidas y revisar tus opciones? " +
    "Si prefieres que no te escribamos, respóndenos \"NO\" y no te contactaremos más."
  );
}

function v360WhatsAppLink(phone, text) {
  return "https://wa.me/1" + phone + "?text=" + encodeURIComponent(text);
}

/* Evita que un nombre como "=IMPORTXML(...)" se ejecute como fórmula. */
function v360Safe(value) {
  if (value instanceof Date || typeof value === "number") return value;
  var s = String(value == null ? "" : value);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function v360TrackingRow(lead, now, ctx) {
  ctx = ctx || {};
  var isActionable = lead.status === "Nuevo" && lead.phone.length === 10;
  var draft = isActionable ? v360WhatsAppDraft(lead) : "";
  var s = v360SuggestPlan(lead, ctx.tariffs);
  var isElectricity = /^electricidad$/i.test(lead.service);
  var enrollUrl = ctx.enrollUrl || V360.ENROLL_URL_ELECTRICIDAD;
  var enroll = isActionable && isElectricity && enrollUrl ? v360EnrollmentDraft(lead, enrollUrl, V360.IBO_ID) : "";
  var blank = function (v) { return v === undefined || v === null ? "" : v; };
  return [
    lead.key, lead.receivedAt || "", lead.name, lead.phone, lead.zip, lead.service, lead.source, lead.medium,
    lead.campaign, lead.ad, lead.priority, lead.classification, lead.reason, lead.duplicateOf, lead.status,
    "", "", draft, isActionable ? v360WhatsAppLink(lead.phone, draft) : "", now,
    blank(s.tdu), blank(s.currentCents), blank(s.planName), blank(s.planCents), blank(s.monthlyDiff),
    enroll, enroll ? v360WhatsAppLink(lead.phone, enroll) : "",
  ].map(v360Safe);
}

/* Línea corta para el correo, sin datos personales: "Paga 20¢ · SureLock 18 a 16.9¢ · ~$31/mes". */
function v360SuggestionLine(s) {
  if (!s || (!s.currentCents && !s.planName)) return "";
  var parts = [];
  if (s.tdu) parts.push(s.tdu);
  if (s.currentCents) parts.push("paga " + s.currentCents + "¢/kWh");
  if (s.planName) parts.push(s.planName + " a " + s.planCents + "¢");
  if (typeof s.monthlyDiff === "number") parts.push((s.monthlyDiff >= 0 ? "ahorro estimado ~$" : "costaría ~$") + Math.abs(s.monthlyDiff) + "/mes");
  return parts.join(" · ");
}

function v360Round(n) {
  return Math.round(n * 100) / 100;
}

function v360Count(list, keyFn) {
  var out = {};
  list.forEach(function (item) {
    var k = keyFn(item) || "(sin dato)";
    out[k] = (out[k] || 0) + 1;
  });
  return Object.keys(out)
    .map(function (k) { return { key: k, count: out[k] }; })
    .sort(function (a, b) { return b.count - a.count || (a.key < b.key ? -1 : 1); });
}

/*
  Calcula métricas SOLO con datos observados.
  - leads: salida de v360ClassifyLeads
  - statusByKey: { clave: estado } leído de Seguimiento (lo pone el dueño)
  - spendRows: [{ date: Date, amount: number, platform, campaign }]
  - settings: { goalStart: Date|null, goalDays, goalQualified, budgetCap }
*/
function v360ComputeMetrics(leads, statusByKey, spendRows, settings, now) {
  var start = settings.goalStart || null;
  var end = start ? new Date(start.getTime() + settings.goalDays * 86400000) : null;
  var inPeriod = function (d) {
    if (!start) return true;
    return d && d.getTime() >= start.getTime() && d.getTime() < end.getTime();
  };
  var weekAgo = now.getTime() - 7 * 86400000;

  var valid = leads.filter(function (l) {
    return l.status !== "Prueba" && l.status !== "Duplicado" && inPeriod(l.receivedAt);
  });
  var status = function (l) { return statusByKey[l.key] || l.status; };
  var qualified = valid.filter(function (l) { return V360.QUALIFIED_STATUSES.indexOf(status(l)) !== -1; });
  var contacted = valid.filter(function (l) { return status(l) !== "Nuevo"; });
  var enrolled = valid.filter(function (l) { return V360.ENROLLED_STATUSES.indexOf(status(l)) !== -1; });
  var pending = valid.filter(function (l) {
    return status(l) === "Nuevo" && l.receivedAt && now.getTime() - l.receivedAt.getTime() > 24 * 3600000;
  });
  var spendInPeriod = spendRows.filter(function (s) { return inPeriod(s.date); });
  var spend = v360Round(spendInPeriod.reduce(function (sum, s) { return sum + (Number(s.amount) || 0); }, 0));
  var hasSpendData = spendInPeriod.length > 0;

  var daysElapsed = start ? Math.max(0, Math.min(settings.goalDays, Math.floor((now.getTime() - start.getTime()) / 86400000))) : null;

  return {
    generatedAt: now,
    period: start ? { start: start, end: end, daysElapsed: daysElapsed, days: settings.goalDays } : null,
    goal: settings.goalQualified,
    leadsValid: valid.length,
    leadsLast7Days: valid.filter(function (l) { return l.receivedAt && l.receivedAt.getTime() >= weekAgo; }).length,
    electricityTexas: valid.filter(function (l) { return l.priority === "A"; }).length,
    qualified: qualified.length,
    enrolled: enrolled.length,
    contacted: contacted.length,
    pendingOver24h: pending.length,
    excludedTests: leads.filter(function (l) { return l.status === "Prueba"; }).length,
    excludedDuplicates: leads.filter(function (l) { return l.status === "Duplicado"; }).length,
    byService: v360Count(valid, function (l) { return l.service; }),
    bySource: v360Count(valid, function (l) { return [l.source, l.medium].filter(Boolean).join(" / "); }),
    byContent: v360Count(valid.filter(function (l) { return l.ad || l.campaign; }), function (l) {
      return [l.campaign, l.ad].filter(Boolean).join(" · ");
    }),
    spend: hasSpendData ? spend : null,
    costPerLead: hasSpendData && valid.length ? v360Round(spend / valid.length) : null,
    costPerQualified: hasSpendData && qualified.length ? v360Round(spend / qualified.length) : null,
    budgetCap: settings.budgetCap,
    budgetUsed: hasSpendData ? v360Round(spend / settings.budgetCap) : 0,
    budgetLevel: !hasSpendData ? "sin gasto" : spend >= settings.budgetCap ? "agotado" : spend >= settings.budgetCap * 0.8 ? "80%" : "ok",
    websiteVisits: null, // No hay analítica web instalada: no se inventa.
  };
}

function v360Money(n) {
  return n == null ? "sin datos" : "$" + Number(n).toFixed(2);
}

function v360Esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
}

function v360DateEs(d) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

/* Panel en filas (para la pestaña Panel). */
function v360PanelRows(m) {
  var rows = [
    ["Panel de leads — Vínculos 360", ""],
    ["Actualizado", m.generatedAt],
    ["Periodo de la meta", m.period ? v360DateEs(m.period.start) + " a " + v360DateEs(m.period.end) + " (día " + m.period.daysElapsed + " de " + m.period.days + ")" : "Sin fecha de inicio (GOAL_START): se cuentan todos los leads"],
    ["", ""],
    ["Leads válidos (sin pruebas ni duplicados)", m.leadsValid],
    ["Leads en los últimos 7 días", m.leadsLast7Days],
    ["Electricidad en Texas (prioridad A)", m.electricityTexas],
    ["Calificados (estado puesto por el equipo)", m.qualified + " de " + m.goal],
    ["Inscritos (clientes dados de alta)", m.enrolled],
    ["Contactados", m.contacted],
    ["Sin contactar por más de 24 h", m.pendingOver24h],
    ["Pruebas excluidas / duplicados excluidos", m.excludedTests + " / " + m.excludedDuplicates],
    ["", ""],
    ["Gasto registrado en anuncios", v360Money(m.spend)],
    ["Tope autorizado", v360Money(m.budgetCap) + " (" + m.budgetLevel + ")"],
    ["Costo por lead", v360Money(m.costPerLead)],
    ["Costo por lead calificado", v360Money(m.costPerQualified)],
    ["Visitas al sitio", "No disponible: no hay analítica web instalada"],
    ["", ""],
    ["Leads por origen", ""],
  ];
  m.bySource.forEach(function (r) { rows.push(["  " + r.key, r.count]); });
  rows.push(["", ""], ["Leads por campaña / publicación", ""]);
  if (!m.byContent.length) rows.push(["  (sin leads con UTM todavía)", ""]);
  m.byContent.forEach(function (r) { rows.push(["  " + r.key, r.count]); });
  rows.push(["", ""], ["Leads por servicio", ""]);
  m.byService.forEach(function (r) { rows.push(["  " + r.key, r.count]); });
  return rows.map(function (r) { return r.map(v360Safe); });
}

/* Reporte semanal en HTML (correo al dueño). Solo cifras agregadas. */
function v360ReportHtml(m, sheetUrl) {
  var tr = function (a, b) { return "<tr><td style='padding:6px 12px;border-bottom:1px solid #e5e7eb'>" + v360Esc(a) + "</td><td style='padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600'>" + v360Esc(b) + "</td></tr>"; };
  var list = function (title, items) {
    if (!items.length) return "<p style='color:#6b7280'>" + v360Esc(title) + ": sin datos.</p>";
    return "<h3 style='font-size:15px;margin:18px 0 6px'>" + v360Esc(title) + "</h3><table style='border-collapse:collapse;width:100%'>" +
      items.slice(0, 8).map(function (r) { return tr(r.key, r.count); }).join("") + "</table>";
  };
  var recs = v360Recommendations(m);
  return "<div style='font-family:Arial,sans-serif;max-width:620px;color:#111827'>" +
    "<h2 style='color:#0b3a6e'>Reporte semanal de leads — Vínculos 360</h2>" +
    "<p style='color:#6b7280'>Generado " + v360Esc(m.generatedAt.toISOString().slice(0, 16).replace("T", " ")) + " UTC. Solo datos observados en la hoja; nada estimado.</p>" +
    "<table style='border-collapse:collapse;width:100%'>" +
    tr("Calificados / meta", m.qualified + " / " + m.goal) +
    tr("Inscritos", m.enrolled) +
    tr("Leads válidos", m.leadsValid) +
    tr("Leads últimos 7 días", m.leadsLast7Days) +
    tr("Electricidad en Texas (A)", m.electricityTexas) +
    tr("Sin contactar > 24 h", m.pendingOver24h) +
    tr("Gasto registrado", v360Money(m.spend)) +
    tr("Costo por lead", v360Money(m.costPerLead)) +
    tr("Costo por calificado", v360Money(m.costPerQualified)) +
    "</table>" +
    list("Por origen", m.bySource) + list("Por campaña / publicación", m.byContent) + list("Por servicio", m.byService) +
    "<h3 style='font-size:15px;margin:18px 0 6px'>Recomendaciones</h3><ul>" +
    recs.map(function (r) { return "<li>" + v360Esc(r) + "</li>"; }).join("") + "</ul>" +
    (sheetUrl ? "<p><a href='" + v360Esc(sheetUrl) + "'>Abrir la hoja de seguimiento</a></p>" : "") +
    "</div>";
}

/* Recomendaciones basadas solo en lo observado. */
function v360Recommendations(m) {
  var recs = [];
  if (m.pendingOver24h > 0) recs.push("Hay " + m.pendingOver24h + " lead(s) sin contactar por más de 24 horas: respóndelos primero.");
  if (m.leadsValid === 0) recs.push("Aún no hay leads válidos en el periodo. Mantén las publicaciones orgánicas y revisa que los enlaces lleven UTM.");
  if (m.leadsValid > 0 && m.qualified === 0) recs.push("Hay leads pero ninguno marcado como Calificado: actualiza la columna Estado en Seguimiento para medir el avance real.");
  if (m.byContent.length) recs.push("La publicación o campaña con más leads es \"" + m.byContent[0].key + "\" (" + m.byContent[0].count + "). Considera repetir ese tema.");
  if (m.budgetLevel === "80%") recs.push("El gasto registrado llegó al 80 % del tope de " + v360Money(m.budgetCap) + ".");
  if (m.budgetLevel === "agotado") recs.push("El gasto registrado alcanzó el tope autorizado. Pausa los anuncios hasta nueva aprobación.");
  if (m.spend == null) recs.push("No hay gasto registrado: el costo por lead se calculará cuando anotes gastos en la pestaña Gastos.");
  if (m.period && m.period.daysElapsed > 0) {
    var needed = Math.max(0, m.goal - m.qualified);
    var left = m.period.days - m.period.daysElapsed;
    if (needed > 0) recs.push("Faltan " + needed + " calificado(s) y quedan " + left + " día(s) de la meta.");
  }
  return recs;
}

/* =========================================================
   INTEGRACIÓN CON GOOGLE (Apps Script)
========================================================= */

function v360Props() {
  var p = PropertiesService.getScriptProperties();
  return {
    get: function (k, d) { var v = p.getProperty(k); return v == null || v === "" ? d : v; },
    set: function (k, v) { p.setProperty(k, String(v)); },
  };
}

function v360Settings() {
  var props = v360Props();
  var start = props.get("GOAL_START", "");
  return {
    spreadsheetId: props.get("SPREADSHEET_ID", ""),
    ownerEmail: props.get("OWNER_EMAIL", "") || Session.getEffectiveUser().getEmail(),
    goalStart: /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(start + "T00:00:00-06:00") : null,
    goalDays: Number(props.get("GOAL_DAYS", 30)),
    goalQualified: Number(props.get("GOAL_QUALIFIED", 10)),
    budgetCap: Number(props.get("BUDGET_CAP_USD", 50)),
    alertDetails: props.get("ALERT_DETAILS", "false") === "true",
  };
}

function v360Retry(fn, attempts) {
  var tries = attempts || 3;
  for (var i = 1; i <= tries; i++) {
    try {
      return fn();
    } catch (e) {
      if (i === tries) throw e;
      Utilities.sleep(500 * Math.pow(2, i - 1));
    }
  }
}

function v360Spreadsheet(settings) {
  if (!settings.spreadsheetId) throw new Error("Falta la propiedad SPREADSHEET_ID.");
  return v360Retry(function () { return SpreadsheetApp.openById(settings.spreadsheetId); });
}

function v360EnsureSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  } else if (headers && sheet.getLastRow() > 0 && sheet.getLastColumn() < headers.length) {
    // Pestaña creada con una versión anterior: agrega solo los encabezados nuevos de la derecha,
    // si los existentes coinciden (nunca mueve ni sobreescribe columnas del dueño).
    var current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    var same = current.every(function (h, i) { return h === headers[i]; });
    if (same) {
      var extra = headers.slice(current.length);
      sheet.getRange(1, current.length + 1, 1, extra.length).setValues([extra]).setFontWeight("bold");
    }
  }
  return sheet;
}

function v360LoadTariffs(ss) {
  var sheet = v360EnsureSheet(ss, V360.SHEETS.tariffs, V360.TARIFF_HEADERS);
  try {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(V360.TDUS, true).setAllowInvalid(true).build();
    sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
  } catch (e) {
    console.warn("No se pudo aplicar la lista de distribuidoras: " + e);
  }
  return v360ReadTariffs(v360Retry(function () { return sheet.getDataRange().getValues(); }));
}

function v360Log(ss, level, message) {
  try {
    var sheet = v360EnsureSheet(ss, V360.SHEETS.log, ["Fecha", "Nivel", "Mensaje"]);
    sheet.appendRow([new Date(), level, String(message).slice(0, 500)]);
    var extra = sheet.getLastRow() - 1 - V360.LOG_MAX_ROWS;
    if (extra > 0) sheet.deleteRows(2, extra);
  } catch (e) {
    console.error("No se pudo escribir en Registro: " + e);
  }
  console.log("[" + level + "] " + message);
}

function v360AlertFailure(settings, error) {
  var props = v360Props();
  var last = Number(props.get("LAST_FAILURE_ALERT", 0));
  var now = Date.now();
  if (now - last < V360.FAILURE_ALERT_EVERY_HOURS * 3600000) return false;
  props.set("LAST_FAILURE_ALERT", now);
  MailApp.sendEmail({
    to: settings.ownerEmail,
    subject: "⚠️ Vínculos 360: falló el agente de leads",
    htmlBody: "<p>El agente de leads tuvo un error y no terminó su revisión:</p><pre>" + v360Esc(String(error && error.message || error)) +
      "</pre><p>Los leads siguen guardados en la pestaña Leads; no se perdió nada. Revisa la pestaña Registro. Este aviso se repite como máximo cada " +
      V360.FAILURE_ALERT_EVERY_HOURS + " horas.</p>",
  });
  return true;
}

function v360ReadSpend(ss) {
  var sheet = v360EnsureSheet(ss, V360.SHEETS.spend, V360.SPEND_HEADERS);
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var date = v360ToDate(values[i][0]);
    var amount = Number(values[i][3]);
    if (date && !isNaN(amount) && amount !== 0) rows.push({ date: date, platform: values[i][1], campaign: values[i][2], amount: amount });
  }
  return rows;
}

function v360ReadTracking(ss) {
  var sheet = v360EnsureSheet(ss, V360.SHEETS.tracking, V360.TRACKING_HEADERS);
  var values = sheet.getDataRange().getValues();
  var statusCol = V360.TRACKING_HEADERS.indexOf("Estado");
  var byKey = {};
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) byKey[String(values[i][0])] = String(values[i][statusCol] || "Nuevo");
  }
  return { sheet: sheet, statusByKey: byKey };
}

function v360LoadAll(ss) {
  var leadsSheet = ss.getSheetByName(V360.SHEETS.leads);
  if (!leadsSheet) throw new Error("No existe la pestaña \"" + V360.SHEETS.leads + "\".");
  var values = v360Retry(function () { return leadsSheet.getDataRange().getValues(); });
  var leads = v360ClassifyLeads(v360ReadLeads(values));
  var tracking = v360ReadTracking(ss);
  return { leads: leads, tracking: tracking };
}

/* Revisa leads nuevos. Idempotente: un lead se agrega a Seguimiento una sola vez. */
function processNewLeads() {
  var settings = v360Settings();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.warn("Otra ejecución sigue en curso; se omite esta.");
    return { skipped: true };
  }
  var ss;
  try {
    ss = v360Spreadsheet(settings);
    var data = v360LoadAll(ss);
    var now = new Date();
    var fresh = data.leads.filter(function (l) { return !(l.key in data.tracking.statusByKey); });

    if (fresh.length) {
      var ctx = { tariffs: v360LoadTariffs(ss), enrollUrl: v360Props().get("ENROLL_URL_ELECTRICIDAD", V360.ENROLL_URL_ELECTRICIDAD) };
      var rows = fresh.map(function (l) { return v360TrackingRow(l, now, ctx); });
      var sheet = data.tracking.sheet;
      v360Retry(function () {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, V360.TRACKING_HEADERS.length).setValues(rows);
      });
      var actionable = fresh.filter(function (l) { return l.status === "Nuevo"; });
      if (actionable.length) v360NotifyNewLeads(settings, ss, actionable, ctx);
    }

    // Se aplica en cada revisión para que todas las filas tengan la lista de estados vigente.
    v360ApplyStatusValidation(data.tracking.sheet);
    var metrics = v360ComputeMetrics(data.leads, v360ReadTracking(ss).statusByKey, v360ReadSpend(ss), settings, now);
    v360WritePanel(ss, metrics);
    v360CheckBudget(settings, metrics);
    v360Log(ss, "info", "Revisión completa: " + fresh.length + " lead(s) nuevo(s) en Seguimiento.");
    return { added: fresh.length, metrics: metrics };
  } catch (error) {
    if (ss) v360Log(ss, "error", error && error.message ? error.message : error);
    v360AlertFailure(settings, error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function v360ApplyStatusValidation(sheet) {
  try {
    var col = V360.TRACKING_HEADERS.indexOf("Estado") + 1;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(V360.STATUSES, true).setAllowInvalid(false).build();
    sheet.getRange(2, col, Math.max(1, sheet.getLastRow() - 1), 1).setDataValidation(rule);
  } catch (e) {
    console.warn("No se pudo aplicar la lista de estados: " + e);
  }
}

function v360NotifyNewLeads(settings, ss, leads, ctx) {
  var lines = leads.map(function (l) {
    var label = "Prioridad " + (l.priority || "-") + " · " + l.classification;
    var suggestion = v360SuggestionLine(v360SuggestPlan(l, ctx && ctx.tariffs));
    if (suggestion) label += " · " + suggestion;
    return settings.alertDetails ? v360FirstName(l.name) + " — " + (l.service || "sin servicio") + " — " + label : label;
  });
  MailApp.sendEmail({
    to: settings.ownerEmail,
    subject: "Vínculos 360: " + leads.length + " lead(s) nuevo(s)",
    htmlBody: "<p>Llegaron " + leads.length + " lead(s) nuevo(s). Los borradores de WhatsApp están listos en la pestaña <b>Seguimiento</b> para que los revises y envíes tú.</p><ul>" +
      lines.map(function (l) { return "<li>" + v360Esc(l) + "</li>"; }).join("") + "</ul><p><a href='" + ss.getUrl() + "'>Abrir la hoja</a></p>",
  });
}

function v360WritePanel(ss, metrics) {
  var sheet = v360EnsureSheet(ss, V360.SHEETS.panel, null);
  var rows = v360PanelRows(metrics);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1).setFontWeight("bold");
}

function v360CheckBudget(settings, metrics) {
  var props = v360Props();
  var levels = { "sin gasto": 0, ok: 0, "80%": 1, agotado: 2 };
  var current = levels[metrics.budgetLevel] || 0;
  var notified = Number(props.get("BUDGET_ALERT_LEVEL", 0));
  if (current > notified) {
    MailApp.sendEmail({
      to: settings.ownerEmail,
      subject: current === 2 ? "🛑 Vínculos 360: se alcanzó el tope de gasto" : "⚠️ Vínculos 360: gasto al 80 % del tope",
      htmlBody: "<p>Gasto registrado: " + v360Money(metrics.spend) + " de " + v360Money(metrics.budgetCap) + ".</p>" +
        (current === 2 ? "<p>Pausa los anuncios. El sistema no gasta dinero por sí solo; este aviso es para que tomes la decisión.</p>" : ""),
    });
    props.set("BUDGET_ALERT_LEVEL", current);
  } else if (current < notified) {
    props.set("BUDGET_ALERT_LEVEL", current);
  }
}

/* Reporte semanal: guarda una fila en Semanal y envía el correo. */
function sendWeeklyReport() {
  var settings = v360Settings();
  var ss;
  try {
    ss = v360Spreadsheet(settings);
    var data = v360LoadAll(ss);
    var metrics = v360ComputeMetrics(data.leads, data.tracking.statusByKey, v360ReadSpend(ss), settings, new Date());
    var weekly = v360EnsureSheet(ss, V360.SHEETS.weekly, V360.WEEKLY_HEADERS);
    weekly.appendRow([metrics.generatedAt, metrics.leadsValid, metrics.electricityTexas, metrics.qualified,
      metrics.spend == null ? "" : metrics.spend, metrics.costPerLead == null ? "" : metrics.costPerLead,
      metrics.costPerQualified == null ? "" : metrics.costPerQualified]);
    MailApp.sendEmail({
      to: settings.ownerEmail,
      subject: "Reporte semanal Vínculos 360: " + metrics.qualified + "/" + metrics.goal + " calificados",
      htmlBody: v360ReportHtml(metrics, ss.getUrl()),
    });
    v360Log(ss, "info", "Reporte semanal enviado.");
    return metrics;
  } catch (error) {
    if (ss) v360Log(ss, "error", "Reporte semanal: " + (error && error.message ? error.message : error));
    v360AlertFailure(settings, error);
    throw error;
  }
}

/* Crea pestañas y activadores. Se puede ejecutar varias veces sin duplicar nada. */
function setup() {
  var settings = v360Settings();
  var ss = v360Spreadsheet(settings);
  v360LoadAll(ss); // valida que "Leads" exista y tenga las columnas esperadas
  v360EnsureSheet(ss, V360.SHEETS.panel, null);
  v360EnsureSheet(ss, V360.SHEETS.weekly, V360.WEEKLY_HEADERS);
  v360EnsureSheet(ss, V360.SHEETS.spend, V360.SPEND_HEADERS);
  v360EnsureSheet(ss, V360.SHEETS.tracking, V360.TRACKING_HEADERS);
  v360LoadTariffs(ss);

  var handlers = ["processNewLeads", "sendWeeklyReport"];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processNewLeads").timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger("sendWeeklyReport").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  v360Log(ss, "info", "Configuración completa: activadores cada 15 min y lunes 8 a. m.");
  return "Listo";
}

/* Prueba con datos ficticios: no lee ni escribe la hoja ni envía correos. */
function runSelfTest() {
  var values = [
    ["Timestamp", "Name", "Phone", "ZipCode", "Service", "Source", "Medium", "Campaign", "Ad", "Fbclid", "Device"],
    [new Date("2026-12-01T15:00:00Z"), "Ana Prueba", "(713) 555-0100", "77001", "Electricidad", "facebook", "organic", "luz-texas", "efl-que-es", "", "Mobile"],
    [new Date("2026-12-01T16:00:00Z"), "Luis Ejemplo", "(713) 000-1234", "77084", "Electricidad", "facebook", "organic", "luz-texas", "efl-que-es", "", "Mobile"],
    [new Date("2026-12-01T16:05:00Z"), "Luis Ejemplo", "713-000-1234", "77084", "Electricidad", "facebook", "organic", "luz-texas", "efl-que-es", "", "Mobile"],
    [new Date("2026-12-02T18:00:00Z"), "Rosa Ejemplo", "512 000 9876", "78701", "Electricidad", "Direct", "", "", "", "", "Desktop"],
    [new Date("2026-12-03T18:00:00Z"), "Mario Ejemplo", "832 000 4567", "77002", "Internet", "facebook", "organic", "luz-texas", "areas-sin-opcion", "", "Mobile"],
  ];
  var leads = v360ClassifyLeads(v360ReadLeads(values));
  var metrics = v360ComputeMetrics(leads, {}, [], { goalStart: null, goalDays: 30, goalQualified: 10, budgetCap: 50 }, new Date("2026-12-04T12:00:00Z"));
  var summary = leads.map(function (l) { return l.name + " → " + l.status + " / " + l.classification; });
  console.log(summary.join("\n"));
  console.log("Leads válidos: " + metrics.leadsValid + ", electricidad TX: " + metrics.electricityTexas);
  return { leads: summary, leadsValid: metrics.leadsValid };
}
