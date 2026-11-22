import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUsPhone, normalizeUsPhone, validateLead } from "../src/lib/validation.js";
import { serviceFromQuery } from "../src/content.js";

test("formatea teléfonos de EE. UU.", () => {
  assert.equal(formatUsPhone("2815551234"), "(281) 555-1234");
  assert.equal(formatUsPhone("+1 281 555 1234"), "(281) 555-1234");
  assert.equal(formatUsPhone("281"), "281");
  assert.equal(formatUsPhone("28155"), "(281) 55");
  assert.equal(normalizeUsPhone("1-281-555-1234"), "2815551234");
});

test("valida un lead completo", () => {
  assert.deepEqual(
    validateLead({ service: "Internet", name: "José Pérez", phone: "(281) 555-1234", zipCode: "77494" }),
    {}
  );
});

test("detecta errores por campo", () => {
  const e = validateLead({ service: "", name: " ", phone: "555", zipCode: "123" });
  assert.ok(e.service && e.name && e.phone && e.zipCode);
  assert.ok(validateLead({ service: "Internet", name: "Ana", phone: "(081) 555-1234", zipCode: "77494" }).phone);
  assert.ok(validateLead({ service: "Gas", name: "Ana", phone: "2815551234", zipCode: "77494" }).service);
});

test("preselecciona servicio desde ?service=", () => {
  assert.equal(serviceFromQuery("?service=electricidad"), "Electricidad");
  assert.equal(serviceFromQuery("?service=Internet"), "Internet");
  assert.equal(serviceFromQuery("?service=otros"), "Otros servicios");
  assert.equal(serviceFromQuery("?service=xyz"), "");
  assert.equal(serviceFromQuery(""), "");
});
