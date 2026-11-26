/* Pruebas del flujo determinista del chatbot y del envío desde el navegador. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
beforeEach(() => store.clear());

const flow = await import("../src/lib/chatbot/flow.js");
const { CHAT_STRINGS, resolveText } = await import("../src/lib/chatbot/strings.js");
const { submitChatLead, toSheetPayload } = await import("../src/lib/chatbot/api.js");
const { QUESTIONS, validateChatLead } = await import("../api/src/lib/rules.js");

const { INITIAL_STATE, answer, back, nextStep, answeredSteps, checkInput, buildLeadPayload, prequalify } = flow;

const CHOICES = {
  electricidad: { property: "casa", decision: "si", bill: "100a200", contract: "vencepronto" },
  internet: { property: "casa", situation: "mejorar", usage: "trabajo", decision: "compartida" },
  seguridad: { housing: "propia", interest: "ambos", timeline: "pronto", decision: "si" },
  otros: { otherType: "movil", property: "casa", decision: "si" },
};

function complete(serviceKey, { method = "whatsapp", zip = "77494" } = {}) {
  let s = answer(INITIAL_STATE, "service", serviceKey);
  for (const q of QUESTIONS[serviceKey]) s = answer(s, `q:${q.id}`, CHOICES[serviceKey][q.id]);
  s = answer(s, "zipCode", zip);
  s = answer(s, "name", "Prueba QA");
  s = answer(s, "preferredContact", method);
  if (method === "correo") s = answer(s, "email", "qa@example.com");
  s = answer(s, "phone", "(281) 555-0100");
  return s;
}

const TRACKING = { source: "facebook", medium: "organic", campaign: "luz", ad: "", fbclid: "", device: "Mobile" };

test("cada servicio hace sus propias preguntas y termina en el consentimiento", () => {
  for (const key of Object.keys(CHOICES)) {
    const s = complete(key);
    assert.equal(nextStep(s).id, "consent", key);
    const ids = answeredSteps(s).map((x) => x.id);
    assert.deepEqual(ids.slice(0, 1 + QUESTIONS[key].length), ["service", ...QUESTIONS[key].map((q) => `q:${q.id}`)]);
    assert.ok(!ids.includes("email"), "el correo solo se pide si es el medio preferido");
  }
});

test("pide correo solo si el medio preferido es correo, antes del teléfono", () => {
  let s = complete("internet", { method: "correo" });
  const ids = answeredSteps(s).map((x) => x.id);
  assert.ok(ids.indexOf("email") < ids.indexOf("phone"));
  assert.equal(s.email, "qa@example.com");
});

test("rechaza respuestas fuera de orden u opciones inexistentes", () => {
  const s = answer(INITIAL_STATE, "service", "hipotecas");
  assert.equal(s, INITIAL_STATE);
  const s2 = answer(INITIAL_STATE, "zipCode", "77494");
  assert.equal(s2, INITIAL_STATE);
});

test("Atrás deshace la última respuesta y cambiar de servicio reinicia las preguntas", () => {
  let s = answer(INITIAL_STATE, "service", "electricidad");
  s = answer(s, "q:property", "casa");
  assert.equal(nextStep(s).id, "q:decision");
  s = back(s);
  assert.equal(nextStep(s).id, "q:property");
  s = back(s);
  assert.equal(nextStep(s).id, "service");
  assert.deepEqual(s, { ...INITIAL_STATE });
});

test("al cambiar el medio de contacto de correo a otro se borra el correo", () => {
  let s = answer(INITIAL_STATE, "service", "otros");
  for (const q of QUESTIONS.otros) s = answer(s, `q:${q.id}`, CHOICES.otros[q.id]);
  s = answer(answer(s, "zipCode", "77001"), "name", "Ana");
  s = answer(s, "preferredContact", "correo");
  s = answer(s, "email", "a@b.co");
  s = back(back(s));
  assert.equal(s.preferredContact, "");
  s = answer(s, "preferredContact", "texto");
  assert.equal(s.email, "");
});

test("valida y normaliza las respuestas escritas", () => {
  assert.deepEqual(checkInput("zipCode", "7749", INITIAL_STATE), { error: "zip_invalid" });
  assert.deepEqual(checkInput("zipCode", "77494", INITIAL_STATE), { value: "77494" });
  assert.deepEqual(checkInput("phone", "2815550100", INITIAL_STATE), { value: "(281) 555-0100" });
  assert.deepEqual(checkInput("phone", "1234", INITIAL_STATE), { error: "phone_invalid" });
  assert.deepEqual(checkInput("name", "  Ana   Pérez ", INITIAL_STATE), { value: "Ana Pérez" });
  assert.deepEqual(checkInput("name", "http://spam", INITIAL_STATE), { error: "name_invalid" });
  assert.deepEqual(checkInput("email", "Ana@Example.COM ", { preferredContact: "correo" }), { value: "ana@example.com" });
  assert.deepEqual(checkInput("email", "ana@", { preferredContact: "correo" }), { error: "email_invalid" });
});

test("el payload del chatbot pasa la misma validación que usa la API", () => {
  for (const key of Object.keys(CHOICES)) {
    const s = complete(key, { method: key === "internet" ? "correo" : "whatsapp" });
    const payload = buildLeadPayload(s, { language: "es", tracking: TRACKING, elapsedMs: 30000, consent: true });
    const checked = validateChatLead(payload);
    assert.equal(checked.error, undefined, `${key}: ${checked.error}`);
  }
  const s = complete("electricidad");
  assert.equal(validateChatLead(buildLeadPayload(s, { language: "es", tracking: TRACKING, elapsedMs: 1, consent: false })).error, "consent_required");
});

test("precalificación: Texas con opción, decide y es para casa", () => {
  assert.equal(prequalify(complete("electricidad", { zip: "77494" })).prequalified, true);
  assert.deepEqual(prequalify(complete("electricidad", { zip: "78701" })).reasons, ["zona_sin_opcion_probable"]);
  assert.deepEqual(prequalify(complete("electricidad", { zip: "33101" })).reasons, ["fuera_de_texas"]);
  assert.equal(prequalify(complete("internet", { zip: "33101" })).prequalified, true);
});

test("todos los textos existen en español e inglés", () => {
  for (const lang of ["es", "en"]) {
    const s = CHAT_STRINGS[lang];
    for (const [key, qs] of Object.entries(QUESTIONS)) {
      assert.ok(s.services[key], `${lang} servicio ${key}`);
      for (const q of qs) {
        for (const ctx of [{ property: "casa" }, { property: "negocio" }, {}]) {
          assert.ok(resolveText(s.questions[q.id]?.text, ctx), `${lang} pregunta ${q.id}`);
          const opts = resolveText(s.questions[q.id].options, ctx);
          for (const o of q.options) assert.ok(opts[o], `${lang} opción ${q.id}.${o}`);
        }
      }
    }
    for (const m of ["whatsapp", "llamada", "texto", "correo"]) {
      assert.ok(s.methods[m]);
      assert.match(s.consentText(m), /Vínculos 360/);
    }
    for (const code of ["zip_invalid", "name_invalid", "phone_invalid", "email_invalid", "email_required"]) assert.ok(s.errors[code]);
  }
});

test("los textos públicos del chat pasan el verificador de afirmaciones (sin proveedores, garantías ni cifras de ahorro)", async () => {
  const { lintText } = await import("../automation/content/claims-lint.mjs");
  for (const [lang, s] of Object.entries(CHAT_STRINGS)) {
    // Los rangos de la factura ("Menos de $100") son opciones de respuesta, no afirmaciones.
    const { bill, ...questions } = s.questions;
    assert.ok(bill);
    const contextual = [{ property: "casa" }, { property: "negocio" }].flatMap((ctx) => [
      resolveText(s.zipQuestion, ctx),
      ...Object.values(questions).flatMap((q) => [resolveText(q.text, ctx), ...Object.values(resolveText(q.options, ctx))]),
      resolveText(bill.text, ctx),
    ]);
    const text = [
      JSON.stringify({ ...s, questions }),
      ...contextual,
      ...["whatsapp", "llamada", "texto", "correo"].flatMap((m) => [s.consentText(m), s.successText(m)]),
      s.whatsappMessage({ name: "Ana", service: s.services.electricidad, zipCode: "77001", method: "texto" }),
    ].join("\n");
    assert.deepEqual(lintText(text, { fileLabel: `chat-${lang}` }), []);
  }
});

test("si es para un negocio, las preguntas hablan del negocio y no del hogar", () => {
  const ctx = { property: "negocio" };
  const es = CHAT_STRINGS.es;
  const en = CHAT_STRINGS.en;
  assert.match(resolveText(es.questions.decision.text, ctx), /tu negocio/);
  assert.doesNotMatch(resolveText(es.questions.decision.text, ctx), /hogar/);
  assert.match(resolveText(es.zipQuestion, ctx), /tu negocio/);
  assert.doesNotMatch(resolveText(es.questions.usage.text, ctx) + JSON.stringify(resolveText(es.questions.usage.options, ctx)), /casa|hogar/);
  assert.match(resolveText(en.questions.decision.text, ctx), /your business/);
  assert.match(resolveText(en.zipQuestion, ctx), /business/);
  // En casa se mantiene el texto del hogar.
  assert.match(resolveText(es.questions.decision.text, { property: "casa" }), /tu hogar/);
  assert.match(resolveText(es.zipQuestion, {}), /tu casa/);
});

test("electricidad usa 'energía eléctrica', no 'luz'", () => {
  const all = [{ property: "casa" }, { property: "negocio" }]
    .flatMap((ctx) => ["bill", "contract"].map((id) => resolveText(CHAT_STRINGS.es.questions[id].text, ctx)))
    .join(" ");
  assert.match(all, /energía eléctrica/);
  assert.doesNotMatch(all, /\bluz\b/i);
});

/* ---------- Envío ---------- */

function payload() {
  return buildLeadPayload(complete("electricidad"), { language: "es", tracking: TRACKING, elapsedMs: 30000, consent: true });
}

const response = (status, body) => ({ status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

test("confirma solo cuando la API confirma", async () => {
  const r = await submitChatLead(payload(), { fetchImpl: async () => response(200, { ok: true, result: "success", id: "x", prequalified: true }) });
  assert.equal(r.status, "confirmed");
  assert.equal(r.via, "api");
  assert.equal(r.prequalified, true);
  const bad = await submitChatLead(payload(), { fetchImpl: async () => response(400, { ok: false, reason: "invalid_phone" }) });
  assert.equal(bad.status, "rejected");
});

test("si la API no existe o no conecta, envía directo a la hoja con las claves del formulario", async () => {
  const sent = [];
  const fallback = async (p) => {
    sent.push(p);
    return { status: "confirmed", reason: "json_ok" };
  };
  const r404 = await submitChatLead(payload(), { fetchImpl: async () => response(404, "Not found"), fallback });
  assert.equal(r404.status, "confirmed");
  assert.equal(r404.via, "sheet_fallback");
  const rNet = await submitChatLead(payload(), { fetchImpl: async () => { throw new TypeError("Failed to fetch"); }, fallback });
  assert.equal(rNet.via, "sheet_fallback");
  const rStore = await submitChatLead(payload(), { fetchImpl: async () => response(502, { ok: false, reason: "storage_unavailable" }), fallback });
  assert.equal(rStore.via, "sheet_fallback");
  assert.equal(sent.length, 3);
  assert.deepEqual(Object.keys(sent[0]).slice(0, 10), ["name", "phone", "zipCode", "service", "source", "medium", "campaign", "ad", "fbclid", "device"]);
  assert.equal(sent[0].service, "Electricidad");
  assert.equal(sent[0].device, "Mobile · Chatbot");
});

test("tiempo agotado = no verificado, sin reenviar (evita duplicados)", async () => {
  let fallbackCalls = 0;
  const r = await submitChatLead(payload(), {
    timeoutMs: 10,
    fetchImpl: (url, opts) =>
      new Promise((_, reject) => opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    fallback: async () => {
      fallbackCalls += 1;
      return { status: "confirmed" };
    },
  });
  assert.equal(r.status, "unverified");
  assert.equal(fallbackCalls, 0);
});

test("toSheetPayload marca el canal y conserva la atribución", () => {
  const p = toSheetPayload(payload());
  assert.equal(p.channel, "chatbot");
  assert.equal(p.source, "facebook");
  assert.equal(p.consent, "sí");
});
