/* =========================================================
   VÍNCULOS 360 — AGENTE DE OPORTUNIDADES (AI Opportunity Discovery)

   Archivo adicional del proyecto de Apps Script "Vinculos 365"
   (el mismo que ya tiene LeadAgent.js). Usa sus funciones v360*.

   Qué hace:
   - Pestaña "Opportunities": registro de oportunidades comerciales
     públicas y verificables (no son leads).
   - discoverOpportunities() (diario, ~6 a. m. de Houston):
       1. Completa las filas que el dueño (o el resumen de Claude) pegó
          con solo Fuente + URL + Resumen: ID, tipo, mercado, puntuación
          0–100, grado A/B/C, acción recomendada y borrador de respuesta.
       2. Marca duplicados por URL normalizada (nunca borra filas).
       3. Trade: agentes inmobiliarios con licencia nueva en el área de
          Houston, desde los datos abiertos de TREC (data.texas.gov,
          API pública Socrata). Máximo OPP_TREC_DAILY_MAX por día.
       4. Vincula una oportunidad con su lead cuando llega a "Leads" un
          registro con utm_content = Opportunity ID (el visitante dio su
          consentimiento en el sitio). Nunca convierte una oportunidad
          en lead por sí sola.
       5. Actualiza la pestaña "Embudo" (dashboard de adquisición).
   - sendDailyBrief() (diario, 7 a. m. de Houston): correo al dueño.

   Qué NO hace: no hace scraping, no inicia sesión en redes sociales,
   no publica, no comenta ni envía mensajes. Las respuestas son
   borradores que una persona revisa y publica a mano.
========================================================= */

var OPP = {
  SHEET: "Opportunities",
  FUNNEL_SHEET: "Embudo",
  HEADERS: [
    "Opportunity ID", "Identificada", "Fuente", "URL", "Publicada", "Mercado", "Tipo", "Ciudad o ZIP",
    "Resumen", "Interacción", "Score", "Grado", "Estado", "Acción recomendada", "Borrador de respuesta",
    "Resultado", "Lead ID", "Clave", "Señales",
  ],
  MARKETS: ["Residencial", "Trade", "Comercial"],
  TYPES: [
    "Busca recomendación", "Mudanza / nuevo residente", "Factura alta", "Renovación de contrato",
    "Nueva comunidad", "Profesional inmobiliario", "Colaboración comercial", "Otro",
  ],
  INTERACTIONS: ["Permitida", "Manual", "No permitida", "Desconocida"],
  STATUSES: ["Nueva", "Verificada", "Contactada", "Respondió", "Convertida en lead", "Descartada", "No contactar"],
  OPEN_STATUSES: ["Nueva", "Verificada", "Contactada", "Respondió"],
  CONTACTED_STATUSES: ["Contactada", "Respondió", "Convertida en lead"],
  GRADE_A: 80,
  GRADE_B: 60,
  SITE: "https://www.vinculos360.com/",
  TREC_DATASET: "https://data.texas.gov/resource/s7ft-44qi.json",
  TREC_COUNTIES: ["HARRIS", "FORT BEND", "MONTGOMERY", "BRAZORIA", "GALVESTON"],
  TREC_NEW_LICENSE_DAYS: 45,
  TREC_DAILY_MAX: 5,
  /* Ciudades con opción de proveedor (área ERCOT con competencia). Lista de apoyo:
     el ZIP o la dirección se confirma siempre con una persona. */
  CHOICE_CITIES: [
    "houston", "katy", "sugar land", "pasadena", "pearland", "baytown", "missouri city", "spring", "humble",
    "cypress", "tomball", "the woodlands", "conroe", "richmond", "rosenberg", "stafford", "league city",
    "galveston", "texas city", "friendswood", "channelview", "dallas", "fort worth", "arlington", "plano",
    "irving", "garland", "grand prairie", "mesquite", "mckinney", "frisco", "denton", "carrollton",
    "corpus christi", "laredo", "mcallen", "brownsville", "harlingen", "edinburg", "pharr", "abilene",
    "odessa", "midland", "waco", "killeen", "tyler", "wichita falls", "lubbock",
  ],
  NO_CHOICE_CITIES: ["austin", "san antonio", "el paso", "new braunfels", "georgetown", "bryan", "college station", "beaumont"],
  /* Tareas de revisión manual (fuentes que no permiten automatización). */
  MANUAL_TASKS: [
    { days: [1, 3, 5], text: "Grupos de Facebook en los que ya estás: busca dentro de cada grupo \"luz\", \"electricidad\", \"compañía de luz\", \"factura\" y \"me mudo\" (últimos 7 días). Pega en Opportunities solo Fuente, URL y un resumen sin datos personales." },
    { days: [2, 4], text: "Nextdoor (si tienes cuenta en tu vecindario): busca \"electricity\", \"electric company\", \"luz\". Nextdoor no permite automatizar la lectura; pega las publicaciones relevantes en Opportunities." },
    { days: [2], text: "Trade: abre en HAR.com el perfil de los agentes nuevos de TREC con grado B o mejor y revisa si atienden en español (campo de idiomas). Si es así, cambia Estado a \"Verificada\"." },
    { days: [4], text: "Nuevas comunidades: revisa el informe de permisos por ZIP del Houston Permitting Center y los anuncios de nuevas comunidades en tu zona. Registra las que tengan casas entregándose este mes." },
  ],
};

/* =========================================================
   NÚCLEO (funciones puras, probadas con node --test)
========================================================= */

function oppText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function oppFold(value) {
  return oppText(value).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* URL normalizada para evitar duplicados: sin utm_*, fbclid, fragmentos ni "www.", "m." o "mbasic.". */
function oppNormalizeUrl(url) {
  var u = oppText(url);
  if (!/^https?:\/\//i.test(u)) return "";
  u = u.replace(/#.*$/, "");
  var parts = u.split("?");
  var base = parts[0].toLowerCase().replace(/^https?:\/\/(www\.|m\.|mbasic\.|web\.)?/, "https://").replace(/\/+$/, "");
  var keep = (parts[1] || "").split("&").filter(function (p) {
    return p && !/^(utm_[a-z]+|fbclid|gclid|mibextid|rdid|ref|__cft__\[[^\]]*\]|__tn__|sfnsn|share_url)=/i.test(p);
  }).sort();
  return base + (keep.length ? "?" + keep.join("&") : "");
}

function oppKey(row) {
  var url = oppNormalizeUrl(row.url);
  if (url) return url;
  var summary = oppFold(row.summary).replace(/[^a-z0-9 ]/g, "").slice(0, 80);
  return summary ? oppFold(row.source) + "|" + summary : "";
}

function oppHasAny(text, words) {
  for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) !== -1) return words[i];
  return "";
}

var OPP_SIGNALS = {
  recommend: ["recomiend", "recomenda", "alguien sabe", "alguien conoce", "que compania", "cual compania", "que proveedor", "buena compania",
    "recommend", "recommendation", "suggestions", "which company", "what company", "best electric", "best electricity", "looking for a"],
  electricity: ["luz", "electricidad", "electrica", "electrico", "energia", "kwh", "kilowatt", "electric", "electricity", "power company", "energy plan"],
  moving: ["me mudo", "nos mudamos", "mudanza", "mudando", "casa nueva", "nuevo en", "nueva en", "recien llegado", "acabo de llegar", "apartamento nuevo",
    "moving to", "just moved", "new to", "relocating", "new home", "closing on", "move-in", "move in"],
  bill: ["factura alta", "factura muy alta", "me llego", "cobraron", "carisim", "muy cara", "muy caro", "subio la luz", "subio mi", "recibo de luz",
    "high bill", "bill was", "bill is", "outrageous", "too expensive", "price went up", "doubled"],
  renewal: ["se vence", "vence mi contrato", "vencimiento", "renovar", "renovacion", "termina mi contrato", "fin de contrato",
    "contract ends", "contract expires", "expiring", "renewal", "renew my"],
  community: ["nueva comunidad", "nuevas casas", "new community", "new homes", "now selling", "grand opening", "move-in ready", "subdivision", "master-planned", "apartments now leasing"],
  realtor: ["realtor", "agente de bienes raices", "bienes raices", "real estate agent", "sales agent", "broker", "property manager", "apartment locator", "localizador de apartamentos", "administrador de propiedades"],
  partner: ["colaboracion", "alianza", "referidos", "referral", "partnership", "collaborat", "networking"],
  commercial: ["negocio", "restaurante", "tienda", "oficina", "local comercial", "business", "restaurant", "store", "office", "commercial"],
  otherService: ["internet", "wifi", "camaras", "alarma", "seguridad", "security", "cable", "tv"],
  spanish: [" el ", " la ", " que ", " de ", " mi ", " por ", " para ", " una ", "alguien", "gracias", "hola"],
};

/* Tipo y mercado según el texto (si la fila no los trae). */
function oppClassify(row) {
  var text = " " + oppFold([row.summary, row.type, row.market, row.source].join(" ")) + " ";
  var hits = [];
  var hit = function (name) {
    var w = oppHasAny(text, OPP_SIGNALS[name]);
    if (w) hits.push(name + ":" + w.trim());
    return Boolean(w);
  };
  var isRealtor = hit("realtor");
  var isPartner = hit("partner");
  var isCommercial = hit("commercial");
  var isElectric = hit("electricity");
  var isRecommend = hit("recommend");
  var isMoving = hit("moving");
  var isBill = hit("bill");
  var isRenewal = hit("renewal");
  var isCommunity = hit("community");
  var isOther = hit("otherService");
  var spanish = oppHasAny(text, OPP_SIGNALS.spanish) !== "";

  var type = "Otro";
  if (isRealtor) type = "Profesional inmobiliario";
  else if (isPartner) type = "Colaboración comercial";
  else if (isRecommend && (isElectric || isOther)) type = "Busca recomendación";
  else if (isRenewal) type = "Renovación de contrato";
  else if (isBill && isElectric) type = "Factura alta";
  else if (isMoving) type = "Mudanza / nuevo residente";
  else if (isCommunity) type = "Nueva comunidad";

  var market = type === "Profesional inmobiliario" || type === "Colaboración comercial" ? "Trade" : isCommercial ? "Comercial" : "Residencial";
  return { type: type, market: market, electric: isElectric, otherService: isOther && !isElectric, spanish: spanish, signals: hits };
}

/* Zona: "eleccion" (área con opción), "sin_eleccion", "texas" (sin precisar), "fuera" o "desconocida". */
function oppZone(location, text) {
  var loc = oppFold(location);
  var zip = (loc.match(/\b(\d{5})\b/) || [])[1];
  if (zip) {
    var p = parseInt(zip.slice(0, 3), 10);
    var texas = (p >= 750 && p <= 799) || p === 733 || p === 885;
    if (!texas) return "fuera";
    return ["782", "787", "798", "799"].indexOf(zip.slice(0, 3)) !== -1 ? "sin_eleccion" : "eleccion";
  }
  var all = " " + loc + " " + oppFold(text) + " ";
  var has = function (list) {
    return list.some(function (c) { return new RegExp("(^|[^a-z])" + c + "([^a-z]|$)").test(all); });
  };
  if (has(OPP.NO_CHOICE_CITIES)) return "sin_eleccion";
  if (has(OPP.CHOICE_CITIES)) return "eleccion";
  if (/\b(texas|tx)\b/.test(all)) return "texas";
  return loc ? "fuera" : "desconocida";
}

function oppDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var s = oppText(value);
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], 12));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return null;
}

/* Puntuación 0–100 (pesos del plan; validar y ajustar con resultados reales).
   Intención 35 · Relevancia 25 · Ubicación 20 · Antigüedad 10 · Interacción autorizada 10. */
function oppScore(row, now, thresholds) {
  var c = oppClassify(row);
  var type = OPP.TYPES.indexOf(row.type) !== -1 ? row.type : c.type;
  var market = OPP.MARKETS.indexOf(row.market) !== -1 ? row.market : c.market;

  var intentByType = {
    "Busca recomendación": 35, "Renovación de contrato": 30, "Mudanza / nuevo residente": 26, "Factura alta": 24,
    "Profesional inmobiliario": 15, "Colaboración comercial": 15, "Nueva comunidad": 12, "Otro": c.signals.length ? 6 : 0,
  };
  var intent = intentByType[type];

  var relevance = 0;
  if (market === "Trade") relevance = 15 + (c.spanish ? 5 : 0);
  else if (c.electric || type === "Mudanza / nuevo residente" || type === "Nueva comunidad") relevance = market === "Comercial" ? 12 : 20;
  else if (c.otherService) relevance = 8;
  if (relevance && c.spanish && market !== "Trade") relevance = Math.min(25, relevance + 5);

  var zone = oppZone(row.location, row.summary);
  var geo = { eleccion: 20, texas: 8, sin_eleccion: 0, fuera: 0, desconocida: 4 }[zone];

  var published = oppDate(row.published);
  var ageDays = published ? Math.floor((now.getTime() - published.getTime()) / 86400000) : null;
  var recency = ageDays == null ? 3 : ageDays <= 2 ? 10 : ageDays <= 7 ? 7 : ageDays <= 14 ? 4 : ageDays <= 30 ? 2 : 0;

  var interaction = { "Permitida": 10, "Manual": 6, "No permitida": 0, "Desconocida": 3 }[row.interaction];
  if (interaction === undefined) interaction = 3;

  var score = Math.max(0, Math.min(100, intent + relevance + geo + recency + interaction));
  var a = (thresholds && thresholds.a) || OPP.GRADE_A;
  var b = (thresholds && thresholds.b) || OPP.GRADE_B;
  // Una oportunidad fuera del área con opción nunca pasa de C: no se puede atender.
  var grade = zone === "sin_eleccion" || zone === "fuera" ? "C" : score >= a ? "A" : score >= b ? "B" : "C";
  return {
    score: score, grade: grade, type: type, market: market, zone: zone, ageDays: ageDays,
    parts: { intent: intent, relevance: relevance, geo: geo, recency: recency, interaction: interaction },
    spanish: c.spanish, signals: c.signals,
  };
}

/* Enlace al analizador con atribución: utm_content = Opportunity ID. */
function oppLink(id, source, lang) {
  var src = oppFold(source).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "oportunidad";
  return OPP.SITE + (lang === "en" ? "en/" : "") + "?utm_source=" + src + "&utm_medium=oportunidad&utm_campaign=opportunity-agent&utm_content=" +
    encodeURIComponent(id) + "#analizador";
}

/* Acción recomendada y borrador. Sin marcas de proveedores, sin precios, sin promesas de ahorro.
   Los borradores son para que una persona los revise y publique: nunca se envían solos. */
function oppDraft(id, s, row) {
  var lang = s.spanish || !oppText(row.summary) ? "es" : "en";
  var link = oppLink(id, row.source, lang);
  if (s.zone === "sin_eleccion" || s.zone === "fuera") {
    return { action: "No responder: el área probablemente no tiene opción de proveedor de energía eléctrica.", draft: "" };
  }
  if (row.interaction === "No permitida") {
    return { action: "No interactuar en esta fuente (sus reglas no lo permiten). Solo sirve como señal de mercado.", draft: "" };
  }
  var es = {
    "Busca recomendación": "¡Hola! Te puedo ayudar a revisar opciones de energía eléctrica para tu código postal. Un primer paso útil: con el total del servicio eléctrico y los kWh de tu última factura calculas tu costo real por kWh aquí: " + link + " — Si quieres, después lo revisamos juntos. Fermín, Vínculos 360.",
    "Renovación de contrato": "¡Hola! Antes de renovar, revisa la fecha de vencimiento y la hoja de datos (EFL) de tu plan. En Texas, en los últimos 14 días del contrato puedes cambiarte sin cargo por cancelación anticipada. Aquí calculas tu costo real por kWh: " + link + " — Fermín, Vínculos 360.",
    "Mudanza / nuevo residente": "¡Bienvenido(a)! Si tu nueva dirección está en un área con opción de proveedor, puedes elegir tu plan de energía eléctrica antes de mudarte. Si quieres, te explico cómo comparar con la hoja de datos (EFL): " + link + " — Fermín, Vínculos 360.",
    "Factura alta": "¡Hola! Para saber si de verdad estás pagando mucho, divide el total del servicio eléctrico entre los kWh. Aquí lo calculas en un minuto: " + link + " — Si quieres, después revisamos opciones para tu código postal. Fermín, Vínculos 360.",
    "Nueva comunidad": "",
    "Profesional inmobiliario": "",
    "Colaboración comercial": "",
    "Otro": "",
  };
  var en = {
    "Busca recomendación": "Hi! I can help you review electricity options for your ZIP code. A useful first step: with your last bill's electric charges and kWh you can see your real cost per kWh here: " + link + " — Happy to go over it with you. Fermín, Vínculos 360.",
    "Renovación de contrato": "Hi! Before renewing, check your plan's expiration date and Electricity Facts Label (EFL). In Texas you can switch without an early termination fee during the last 14 days of your contract. Check your real cost per kWh here: " + link + " — Fermín, Vínculos 360.",
    "Mudanza / nuevo residente": "Welcome! If your new address is in an area with electricity choice, you can pick your plan before moving in. Happy to explain how to compare using the EFL: " + link + " — Fermín, Vínculos 360.",
    "Factura alta": "Hi! To know if you're really paying a lot, divide the electric charges by the kWh. You can calculate it here: " + link + " — Happy to review options for your ZIP afterwards. Fermín, Vínculos 360.",
  };
  var actions = {
    "Busca recomendación": "Responder en la publicación con el borrador (revisa las reglas del grupo). No pedir datos personales en público.",
    "Renovación de contrato": "Responder con el borrador; si contesta, ofrecer la revisión personalizada en el sitio.",
    "Mudanza / nuevo residente": "Responder con el borrador; confirmar que la dirección esté en un área con opción.",
    "Factura alta": "Responder con el borrador del analizador; no prometer ahorros.",
    "Nueva comunidad": "Investigar quién administra la comunidad (oficina de ventas o leasing) y proponer material informativo para nuevos residentes. Requiere tu aprobación antes de contactar.",
    "Profesional inmobiliario": "Verificar en HAR.com si atiende en español. Si es así, proponer una colaboración de referidos (requiere tu aprobación antes de contactar).",
    "Colaboración comercial": "Revisar la propuesta y decidir si conviene. Requiere tu aprobación antes de contactar.",
    "Otro": "Revisar manualmente: puede no ser una oportunidad.",
  };
  var draft = (lang === "en" ? en[s.type] : es[s.type]) || "";
  var action = actions[s.type] || actions.Otro;
  if (s.grade === "C" && draft) action = "Prioridad baja. " + action;
  return { action: action, draft: draft };
}

/* Lee la pestaña Opportunities a objetos (fila 1 = encabezados). */
function oppReadRows(values) {
  if (!values || values.length < 1) return [];
  var header = values[0].map(oppText);
  var idx = function (name) { return header.indexOf(name); };
  var get = function (row, name) { var i = idx(name); return i === -1 ? "" : row[i]; };
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return c === "" || c == null; })) continue;
    out.push({
      rowNumber: r + 1,
      id: oppText(get(row, "Opportunity ID")),
      identified: get(row, "Identificada"),
      source: oppText(get(row, "Fuente")),
      url: oppText(get(row, "URL")),
      published: get(row, "Publicada"),
      market: oppText(get(row, "Mercado")),
      type: oppText(get(row, "Tipo")),
      location: oppText(get(row, "Ciudad o ZIP")),
      summary: oppText(get(row, "Resumen")),
      interaction: oppText(get(row, "Interacción")),
      score: get(row, "Score"),
      grade: oppText(get(row, "Grado")),
      status: oppText(get(row, "Estado")),
      action: oppText(get(row, "Acción recomendada")),
      draft: oppText(get(row, "Borrador de respuesta")),
      result: oppText(get(row, "Resultado")),
      leadId: oppText(get(row, "Lead ID")),
      key: oppText(get(row, "Clave")),
      signals: oppText(get(row, "Señales")),
    });
  }
  return out;
}

function oppNewId(now, seq) {
  var d = Utilities.formatDate ? Utilities.formatDate(now, "America/Chicago", "yyyyMMdd") : now.toISOString().slice(0, 10).replace(/-/g, "");
  return "OPP-" + d + "-" + ("00" + seq).slice(-3);
}

/* Completa filas nuevas o incompletas. Nunca cambia lo que el dueño ya escribió
   (Estado, Resultado, Lead ID, borradores editados). Para recalcular la puntuación,
   borra la celda Score. Devuelve las filas con `changed` y los duplicados marcados. */
function oppEnrich(rows, now, thresholds, idFn) {
  var seenKeys = {};
  var seq = 0;
  rows.forEach(function (r) {
    if (r.id) {
      var m = /-(\d{3})$/.exec(r.id);
      if (m && r.id.indexOf(oppNewId(now, 0).slice(0, 12)) === 0) seq = Math.max(seq, +m[1]);
      if (r.key) seenKeys[r.key] = seenKeys[r.key] || r.id;
    }
  });
  return rows.map(function (r) {
    var out = Object.assign({}, r, { changed: false, duplicateOf: "" });
    if (!r.url && !r.summary) return out;
    if (!out.id) {
      seq += 1;
      out.id = idFn ? idFn(seq) : oppNewId(now, seq);
      out.changed = true;
    }
    if (!out.identified) { out.identified = now; out.changed = true; }
    if (!out.key) {
      out.key = oppKey(r);
      out.changed = true;
      if (out.key && seenKeys[out.key] && seenKeys[out.key] !== out.id) {
        out.duplicateOf = seenKeys[out.key];
        out.status = "Descartada";
        out.result = out.result || "Duplicado de " + out.duplicateOf;
        return out;
      }
      if (out.key) seenKeys[out.key] = out.id;
    }
    if (out.score === "" || out.score == null) {
      var s = oppScore(out, now, thresholds);
      out.score = s.score;
      out.grade = s.grade;
      if (!out.type) out.type = s.type;
      if (!out.market) out.market = s.market;
      if (!out.interaction) out.interaction = "Desconocida";
      out.signals = "I" + s.parts.intent + " R" + s.parts.relevance + " U" + s.parts.geo + " A" + s.parts.recency + " X" + s.parts.interaction +
        (s.signals.length ? " · " + s.signals.join(", ") : "") + (s.zone ? " · zona " + s.zone : "");
      var d = oppDraft(out.id, s, out);
      if (!out.action) out.action = d.action;
      if (!out.draft) out.draft = d.draft;
      out.changed = true;
    }
    if (!out.status) { out.status = "Nueva"; out.changed = true; }
    if (!r.url && out.status === "Nueva") {
      out.action = "Sin URL verificable: agrega el enlace o descártala. " + (out.action || "");
    }
    return out;
  });
}

function oppToRow(o) {
  var map = {
    "Opportunity ID": o.id, "Identificada": o.identified, "Fuente": o.source, "URL": o.url, "Publicada": o.published,
    "Mercado": o.market, "Tipo": o.type, "Ciudad o ZIP": o.location, "Resumen": o.summary, "Interacción": o.interaction,
    "Score": o.score, "Grado": o.grade, "Estado": o.status, "Acción recomendada": o.action, "Borrador de respuesta": o.draft,
    "Resultado": o.result, "Lead ID": o.leadId, "Clave": o.key, "Señales": o.signals,
  };
  return OPP.HEADERS.map(function (h) {
    var v = map[h];
    // Textos copiados de fuentes externas: neutraliza fórmulas (=, +, -, @).
    return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v == null ? "" : v;
  });
}

/* TREC (datos abiertos) → candidatos Trade. Solo datos públicos de licencia; sin teléfonos ni correos. */
function oppFromTrec(records, now, maxDays) {
  var out = [];
  (records || []).forEach(function (rec) {
    var licensed = oppDate(rec.original_license_date);
    if (!licensed) return;
    var age = Math.floor((now.getTime() - licensed.getTime()) / 86400000);
    if (age < 0 || age > (maxDays || OPP.TREC_NEW_LICENSE_DAYS)) return;
    if (!/sales agent/i.test(rec.license_type || "") || !/^active$/i.test(oppText(rec.status))) return;
    var number = oppText(rec.license_number);
    if (!number) return;
    var county = oppText(rec.county);
    out.push({
      source: "TREC (datos abiertos)",
      url: OPP.TREC_DATASET + "?license_number=" + encodeURIComponent(number),
      published: licensed,
      market: "Trade",
      type: "Profesional inmobiliario",
      location: county ? county.charAt(0) + county.slice(1).toLowerCase() + " County, TX" : "Texas",
      summary: "Agente inmobiliario con licencia nueva (" + number + "): " + oppText(rec.full_name) +
        (rec.related_license_full_name ? " · broker " + oppText(rec.related_license_full_name) : "") +
        ". Idioma no verificado.",
      interaction: "Manual",
    });
  });
  return out;
}

/* Vincula oportunidades con leads que llegaron con utm_content = Opportunity ID. */
function oppLinkLeads(opps, leads) {
  var byId = {};
  opps.forEach(function (o) { if (o.id) byId[o.id.toUpperCase()] = o; });
  var linked = [];
  (leads || []).forEach(function (l) {
    var id = oppText(l.ad).toUpperCase();
    var o = byId[id];
    if (!o || o.leadId || l.status === "Prueba") return;
    o.leadId = l.leadId || "Leads fila " + l.rowNumber;
    if (o.status !== "No contactar") o.status = "Convertida en lead";
    o.result = o.result || "Lead recibido por el sitio con consentimiento. Verificar elegibilidad en Seguimiento.";
    o.changed = true;
    linked.push(o.id);
  });
  return linked;
}

/* Métricas del embudo de oportunidades. */
function oppMetrics(opps, now, start, end) {
  var inPeriod = function (o) {
    var d = oppDate(o.identified);
    if (!start) return true;
    return d && d.getTime() >= start.getTime() && (!end || d.getTime() < end.getTime());
  };
  var list = opps.filter(function (o) { return o.id && inPeriod(o) && !/^Duplicado/.test(o.result); });
  var dayAgo = now.getTime() - 86400000;
  var count = function (fn) { return list.filter(fn).length; };
  var bySource = {};
  list.forEach(function (o) {
    var k = o.source || "Sin fuente";
    bySource[k] = bySource[k] || { identified: 0, contacted: 0, leads: 0 };
    bySource[k].identified += 1;
    if (OPP.CONTACTED_STATUSES.indexOf(o.status) !== -1) bySource[k].contacted += 1;
    if (o.leadId) bySource[k].leads += 1;
  });
  return {
    identified: list.length,
    verified: count(function (o) { return o.status && o.status !== "Nueva" && o.status !== "Descartada" && o.url; }),
    contacted: count(function (o) { return OPP.CONTACTED_STATUSES.indexOf(o.status) !== -1; }),
    converted: count(function (o) { return Boolean(o.leadId); }),
    discarded: count(function (o) { return o.status === "Descartada"; }),
    last24h: count(function (o) { var d = oppDate(o.identified); return d && d.getTime() >= dayAgo; }),
    gradeA: count(function (o) { return o.grade === "A" && OPP.OPEN_STATUSES.indexOf(o.status) !== -1; }),
    bySource: bySource,
  };
}

/* Seguimientos pendientes: contactadas hace más de 2 días sin resultado. */
function oppFollowUps(opps, now) {
  return opps.filter(function (o) {
    if (o.status !== "Contactada" || o.result) return false;
    var d = oppDate(o.identified);
    return d && now.getTime() - d.getTime() > 2 * 86400000;
  });
}

function oppManualTasks(now) {
  var day = new Date(now.getTime() - 6 * 3600000).getUTCDay(); // aprox. hora de Houston
  return OPP.MANUAL_TASKS.filter(function (t) { return t.days.indexOf(day) !== -1; }).map(function (t) { return t.text; });
}

function oppEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Correo diario. Nunca inventa: si no hay oportunidades, lo dice. */
function oppBriefHtml(ctx) {
  var o = ctx.opps;
  var now = ctx.now;
  var dayAgo = now.getTime() - 86400000;
  var fresh = o.filter(function (x) { var d = oppDate(x.identified); return x.id && d && d.getTime() >= dayAgo && !/^Duplicado/.test(x.result); });
  var priority = o.filter(function (x) { return x.grade === "A" && OPP.OPEN_STATUSES.indexOf(x.status) !== -1; });
  var converted = o.filter(function (x) { return x.leadId && x.status === "Convertida en lead"; });
  var follow = oppFollowUps(o, now);
  var m = ctx.metrics;
  var card = function (x) {
    return "<li style=\"margin-bottom:12px\"><b>" + oppEsc(x.id) + " · " + oppEsc(x.grade) + " (" + oppEsc(x.score) + ")</b> · " + oppEsc(x.type) +
      " · " + oppEsc(x.location || "ubicación no indicada") + "<br>" + oppEsc(x.summary) +
      (x.url ? "<br><a href=\"" + oppEsc(x.url) + "\">" + oppEsc(x.source || "Fuente") + "</a>" : "<br><i>Sin URL verificable</i>") +
      "<br><b>Acción:</b> " + oppEsc(x.action) + (x.draft ? "<br><b>Borrador:</b> " + oppEsc(x.draft) : "") + "</li>";
  };
  var section = function (title, items, empty) {
    return "<h3 style=\"margin:20px 0 8px\">" + title + "</h3>" + (items.length ? "<ul>" + items.join("") + "</ul>" : "<p>" + empty + "</p>");
  };
  var html = "<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#0f172a\">" +
    "<h2 style=\"margin:0\">Oportunidades del día · Vínculos 360</h2>" +
    "<p style=\"color:#475569\">" + oppEsc(ctx.dateLabel) + ". Oportunidades = señales públicas; no son leads hasta que la persona deja sus datos con consentimiento.</p>" +
    "<p><b>Embudo (periodo de la meta):</b> " + m.identified + " identificadas · " + m.verified + " verificadas · " + m.contacted +
    " contactadas · " + m.converted + " convertidas en lead. Leads calificados: " + (ctx.qualified == null ? "sin datos" : ctx.qualified) +
    " de " + ctx.goal + ".</p>" +
    section("Alta prioridad (A, abiertas)", priority.slice(0, 10).map(card), "No hay oportunidades A abiertas.") +
    section("Nuevas en las últimas 24 horas", fresh.filter(function (x) { return x.grade !== "A"; }).slice(0, 15).map(card),
      fresh.length ? "Las nuevas de hoy ya están arriba." : "Sin oportunidades nuevas verificadas en las últimas 24 horas.") +
    section("Convertidas en lead", converted.slice(0, 10).map(function (x) {
      return "<li>" + oppEsc(x.id) + " → " + oppEsc(x.leadId) + "</li>";
    }), "Ninguna todavía.") +
    section("Seguimientos pendientes", follow.slice(0, 10).map(function (x) {
      return "<li>" + oppEsc(x.id) + " · contactada sin resultado. " + (x.url ? "<a href=\"" + oppEsc(x.url) + "\">ver</a>" : "") + "</li>";
    }), "Sin seguimientos pendientes.") +
    section("Tareas de revisión manual de hoy", ctx.manualTasks.map(function (t) { return "<li>" + oppEsc(t) + "</li>"; }), "Ninguna hoy.") +
    section("Estado de las fuentes", ctx.sources.map(function (s) {
      return "<li>" + (s.ok ? "✅ " : "⚠️ ") + oppEsc(s.name) + ": " + oppEsc(s.note) + "</li>";
    }), "Sin revisión de fuentes registrada hoy.") +
    "<p style=\"color:#64748b;font-size:12px;margin-top:24px\">Los borradores no se publican solos: revisa las reglas de cada grupo antes de responder. " +
    "Hoja: <a href=\"" + oppEsc(ctx.sheetUrl) + "\">Opportunities</a>.</p></div>";
  return { html: html, counts: { fresh: fresh.length, priority: priority.length, converted: converted.length, follow: follow.length } };
}

/* Filas del dashboard "Embudo": oportunidades → prospectos → leads → calificados → clientes. */
function oppFunnelRows(om, lm) {
  var f = lm.funnel || {};
  var rows = [
    ["Dashboard de adquisición y conversión", ""],
    ["Actualizado", lm.generatedAt],
    ["Periodo", lm.period ? v360DateEs(lm.period.start) + " → " + v360DateEs(lm.period.end) : "Sin GOAL_START: todo el historial"],
    ["", ""],
    ["1. Oportunidades (señales públicas)", ""],
    ["  Identificadas", om.identified],
    ["  Verificadas", om.verified],
    ["  Contactadas (prospectos)", om.contacted],
    ["  Convertidas en lead", om.converted],
    ["", ""],
    ["2. Sitio web (eventos anónimos)", ""],
    ["  Visitas al analizador de factura", f.analyzer_view == null ? "sin datos" : f.analyzer_view],
    ["  Cálculos completados", f.analyzer_calc == null ? "sin datos" : f.analyzer_calc],
    ["  Solicitudes de comparación", f.analyzer_cta == null ? "sin datos" : f.analyzer_cta],
    ["  Chats iniciados / completados", f.chat_start == null ? "sin datos" : f.chat_start + " / " + f.chat_complete],
    ["", ""],
    ["3. Leads (datos + consentimiento)", ""],
    ["  Leads válidos", lm.leadsValid],
    ["  Leads calificados (meta " + lm.goal + ")", lm.qualified],
    ["  Inscripciones (Inscrito / Cliente)", lm.enrolled],
    ["", ""],
    ["4. Costos", ""],
    ["  Gasto en anuncios", lm.spend == null ? "sin gasto registrado" : lm.spend],
    ["  Costo por lead", lm.costPerLead == null ? "sin datos" : lm.costPerLead],
    ["  Costo por lead calificado", lm.costPerQualified == null ? "sin datos" : lm.costPerQualified],
    ["  Costo de adquisición (por inscripción)", lm.spend == null || !lm.enrolled ? "sin datos" : v360Round(lm.spend / lm.enrolled)],
    ["", ""],
    ["Conversiones por fuente de oportunidad", "identificadas / contactadas / leads"],
  ];
  Object.keys(om.bySource).sort().forEach(function (k) {
    var s = om.bySource[k];
    rows.push(["  " + k, s.identified + " / " + s.contacted + " / " + s.leads]);
  });
  rows.push(["", ""], ["Leads por canal (calificados)", ""]);
  var q = {};
  (lm.qualifiedByChannel || []).forEach(function (r) { q[r.key] = r.count; });
  (lm.byChannel || []).forEach(function (r) { rows.push(["  " + r.key, r.count + " (" + (q[r.key] || 0) + ")"]); });
  rows.push(["", ""], ["Leads por origen (UTM)", ""]);
  (lm.bySource || []).forEach(function (r) { rows.push(["  " + (r.key || "Directo"), r.count]); });
  rows.push(["", ""], ["Definiciones", "Oportunidad: señal pública. Prospecto: oportunidad contactada. Lead: dejó sus datos con consentimiento. Calificado: lo confirma una persona en Seguimiento. Cliente: Inscrito o Cliente."]);
  return rows.map(function (r) { return r.map(function (v) { return v instanceof Date ? v : v360Safe(v); }); });
}

/* =========================================================
   INTEGRACIÓN CON GOOGLE
========================================================= */

function oppThresholds() {
  var p = v360Props();
  return { a: Number(p.get("OPP_GRADE_A", OPP.GRADE_A)) || OPP.GRADE_A, b: Number(p.get("OPP_GRADE_B", OPP.GRADE_B)) || OPP.GRADE_B };
}

function oppSheet(ss) {
  var sheet = v360EnsureSheet(ss, OPP.SHEET, OPP.HEADERS);
  try {
    var col = function (name) { return OPP.HEADERS.indexOf(name) + 1; };
    var rows = Math.max(1, sheet.getMaxRows() - 1);
    var list = function (values) { return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build(); };
    sheet.getRange(2, col("Estado"), rows, 1).setDataValidation(list(OPP.STATUSES));
    sheet.getRange(2, col("Mercado"), rows, 1).setDataValidation(list(OPP.MARKETS));
    sheet.getRange(2, col("Tipo"), rows, 1).setDataValidation(list(OPP.TYPES));
    sheet.getRange(2, col("Interacción"), rows, 1).setDataValidation(list(OPP.INTERACTIONS));
  } catch (e) {
    console.warn("No se pudieron aplicar las listas de Opportunities: " + e);
  }
  return sheet;
}

function oppLoad(ss) {
  var sheet = oppSheet(ss);
  var values = v360Retry(function () { return sheet.getDataRange().getValues(); });
  return { sheet: sheet, rows: oppReadRows(values) };
}

function oppWrite(sheet, rows) {
  rows.forEach(function (o) {
    if (!o.changed && !o.duplicateOf) return;
    v360Retry(function () { sheet.getRange(o.rowNumber, 1, 1, OPP.HEADERS.length).setValues([oppToRow(o)]); });
  });
}

/* TREC vía API pública de data.texas.gov (Socrata). Sin clave; límite de uso de Socrata para consultas anónimas. */
function oppFetchTrec(now) {
  var since = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 19);
  var where = "license_type='Sales Agent' AND status='Active' AND updated > '" + since + "' AND upper(county) in(" +
    OPP.TREC_COUNTIES.map(function (c) { return "'" + c + "'"; }).join(",") + ")";
  // UrlFetchApp rechaza URLs con ' ( ) sin codificar ("Address unavailable"): se codifican todos.
  var url = OPP.TREC_DATASET + "?%24limit=500&%24where=" + oppEncode(where);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: "application/json" } });
  if (res.getResponseCode() !== 200) throw new Error("TREC respondió " + res.getResponseCode());
  return JSON.parse(res.getContentText());
}

/* encodeURIComponent deja sin codificar ! ' ( ) *; UrlFetchApp no los acepta en la URL. */
function oppEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, function (c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

/* Diario (6 a. m.): completa, deduplica, agrega Trade de TREC, vincula leads y actualiza Embudo.
   Un activador pasa un objeto de evento; las pruebas pueden pasar una fecha fija. */
function discoverOpportunities(at) {
  var settings = v360Settings();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return "Ocupado";
  var sources = [];
  var ss;
  try {
    ss = v360Spreadsheet(settings);
    var now = at instanceof Date ? at : new Date();
    var data = oppLoad(ss);
    var props = v360Props();

    // Trade: agentes con licencia nueva (TREC). Se puede apagar con OPP_TREC_ENABLED=false.
    if (props.get("OPP_TREC_ENABLED", "true") === "true") {
      try {
        var candidates = oppFromTrec(oppFetchTrec(now), now, Number(props.get("OPP_TREC_NEW_DAYS", OPP.TREC_NEW_LICENSE_DAYS)));
        var known = {};
        data.rows.forEach(function (r) { known[r.key || oppKey(r)] = true; });
        var max = Number(props.get("OPP_TREC_DAILY_MAX", OPP.TREC_DAILY_MAX));
        var added = 0;
        candidates.forEach(function (c) {
          if (added >= max || known[oppKey(c)]) return;
          known[oppKey(c)] = true;
          data.sheet.appendRow(oppToRow(c));
          added += 1;
        });
        sources.push({ name: "TREC (datos abiertos)", ok: true, note: added + " agente(s) nuevo(s) agregado(s) de " + candidates.length + " candidato(s)." });
        if (added) data = oppLoad(ss);
      } catch (e) {
        sources.push({ name: "TREC (datos abiertos)", ok: false, note: "no disponible: " + e });
      }
    } else {
      sources.push({ name: "TREC (datos abiertos)", ok: true, note: "apagada (OPP_TREC_ENABLED=false)." });
    }

    var enriched = oppEnrich(data.rows, now, oppThresholds());
    var leadsData = v360LoadAll(ss);
    var linked = oppLinkLeads(enriched, leadsData.leads);
    oppWrite(data.sheet, enriched);
    sources.push({ name: "Entrada manual y resumen de Claude", ok: true, note: enriched.filter(function (o) { return o.changed; }).length + " fila(s) completada(s); " + linked.length + " vinculada(s) a un lead." });

    // Dashboard "Embudo".
    var withFunnel = v360WithFunnel(ss, settings);
    var lm = v360ComputeMetrics(leadsData.leads, leadsData.tracking.statusByKey, v360ReadSpend(ss), withFunnel, now);
    var end = settings.goalStart ? new Date(settings.goalStart.getTime() + settings.goalDays * 86400000) : null;
    var om = oppMetrics(enriched, now, settings.goalStart, end);
    var funnel = v360EnsureSheet(ss, OPP.FUNNEL_SHEET, null);
    var rows = oppFunnelRows(om, lm);
    funnel.clearContents();
    funnel.getRange(1, 1, rows.length, 2).setValues(rows);

    props.set("OPP_SOURCES_LAST", JSON.stringify({ at: now.toISOString(), sources: sources }));
    v360Log(ss, "info", "Oportunidades: " + sources.map(function (s) { return s.name + " → " + s.note; }).join(" | "));
    return "Listo";
  } catch (e) {
    if (ss) v360Log(ss, "error", "Oportunidades falló: " + e);
    v360AlertFailure(settings, e);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/* Diario (7 a. m. de Houston): correo con el resumen. */
function sendDailyBrief(at) {
  var settings = v360Settings();
  var ss = v360Spreadsheet(settings);
  var now = at instanceof Date ? at : new Date();
  var data = oppLoad(ss);
  var leadsData = v360LoadAll(ss);
  var lm = v360ComputeMetrics(leadsData.leads, leadsData.tracking.statusByKey, v360ReadSpend(ss), settings, now);
  var end = settings.goalStart ? new Date(settings.goalStart.getTime() + settings.goalDays * 86400000) : null;
  var last = {};
  try { last = JSON.parse(v360Props().get("OPP_SOURCES_LAST", "{}")); } catch (e) { last = {}; }
  var sources = last.sources || [];
  if (!last.at || now.getTime() - new Date(last.at).getTime() > 26 * 3600000) {
    sources = [{ name: "Agente de oportunidades", ok: false, note: "no corrió en las últimas 26 horas (revisa la pestaña Registro)." }].concat(sources);
  }
  var brief = oppBriefHtml({
    opps: data.rows, now: now, metrics: oppMetrics(data.rows, now, settings.goalStart, end), qualified: lm.qualified, goal: settings.goalQualified,
    sources: sources, manualTasks: oppManualTasks(now), sheetUrl: ss.getUrl(), dateLabel: v360DateEs(now),
  });
  MailApp.sendEmail({
    to: settings.ownerEmail,
    subject: "Vínculos 360 · Oportunidades del día: " + brief.counts.priority + " A · " + brief.counts.fresh + " nuevas",
    htmlBody: brief.html,
  });
  v360Log(ss, "info", "Resumen diario enviado (" + brief.counts.fresh + " nuevas, " + brief.counts.priority + " A).");
  return brief.counts;
}

/* Crea la pestaña, el dashboard y los activadores diarios. Se puede ejecutar varias veces. */
function setupOpportunities() {
  var settings = v360Settings();
  var ss = v360Spreadsheet(settings);
  oppSheet(ss);
  v360EnsureSheet(ss, OPP.FUNNEL_SHEET, null);
  var handlers = ["discoverOpportunities", "sendDailyBrief"];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  // Zona horaria del proyecto: America/Chicago (Houston).
  ScriptApp.newTrigger("discoverOpportunities").timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger("sendDailyBrief").timeBased().everyDays(1).atHour(7).nearMinute(0).create();
  v360Log(ss, "info", "Oportunidades: pestaña lista y activadores diarios 6 a. m. y 7 a. m.");
  return "Listo";
}

/* Prueba con datos ficticios: no lee ni escribe la hoja, no llama APIs ni envía correos. */
function runOpportunitySelfTest() {
  var now = new Date();
  var rows = oppEnrich([
    { rowNumber: 2, source: "Facebook grupo", url: "https://www.facebook.com/groups/1/posts/2?utm_source=x", summary: "¿Qué compañía de luz me recomiendan en Katy? Me llegó muy alta la factura", interaction: "Manual", published: now },
    { rowNumber: 3, source: "Facebook grupo", url: "https://m.facebook.com/groups/1/posts/2", summary: "duplicado", interaction: "Manual" },
    { rowNumber: 4, source: "Búsqueda web", url: "https://example.com/austin", summary: "Busco proveedor de electricidad en Austin", location: "Austin" },
  ], now, { a: 80, b: 60 });
  var lines = rows.map(function (r) { return r.id + " " + r.grade + " " + r.score + " " + r.type + " " + (r.duplicateOf ? "(dup)" : ""); });
  console.log(lines.join("\n"));
  return lines;
}
