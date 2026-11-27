/* Medición Google: sin datos personales, nombres estándar y WhatsApp correcto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_EVENTS, gaEventName, isBusinessWhatsAppUrl, sanitizeParams } from "../src/lib/analytics.js";
import { EVENT_NAMES, validateEvent } from "../api/src/lib/rules.js";

test("sanitizeParams descarta cualquier dato personal o texto libre", () => {
  const clean = sanitizeParams({
    language: "es",
    service: "electricidad",
    entry_point: "formulario",
    name: "Ana López",
    phone: "281-555-0100",
    email: "ana@example.com",
    zipCode: "77001",
    bill: "148",
  });
  assert.deepEqual(clean, { language: "es", service: "electricidad", entry_point: "formulario" });
});

test("sanitizeParams rechaza valores fuera de la lista (aunque la clave sea válida)", () => {
  assert.deepEqual(sanitizeParams({ language: "fr", service: "Ana López", entry_point: "77001" }), {});
});

test("los eventos del analizador usan los nombres estándar en GA4", () => {
  assert.equal(gaEventName("analyzer_calc"), "analyzer_completed");
  assert.equal(gaEventName("analyzer_cta"), "comparison_requested");
  assert.equal(gaEventName("lead_submitted"), "lead_submitted");
  assert.deepEqual(FUNNEL_EVENTS, ["analyzer_started", "analyzer_completed", "comparison_requested", "lead_submitted", "whatsapp_clicked"]);
});

test("la API de métricas acepta los eventos nuevos y sigue sin guardar datos personales", () => {
  for (const event of ["analyzer_started", "lead_submitted", "whatsapp_clicked"]) {
    assert.ok(EVENT_NAMES.includes(event), event);
    assert.deepEqual(validateEvent({ event, language: "es", serviceKey: "electricidad", phone: "2815550100" }), {
      event: { event, language: "es", serviceKey: "electricidad" },
    });
  }
});

test("WhatsApp: cuenta el chat con el negocio, no el botón de compartir", () => {
  assert.equal(isBusinessWhatsAppUrl("https://wa.me/12818257327?text=Hola"), true);
  assert.equal(isBusinessWhatsAppUrl("https://api.whatsapp.com/send?phone=12818257327"), true);
  assert.equal(isBusinessWhatsAppUrl("https://wa.me/?text=Mira%20esto"), false);
  assert.equal(isBusinessWhatsAppUrl("https://www.facebook.com/vinculos360"), false);
});
