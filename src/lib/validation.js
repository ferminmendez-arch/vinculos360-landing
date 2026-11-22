import { SERVICES } from "../content.js";

const SERVICE_VALUES = SERVICES.map((s) => s.value);

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/* 10 dígitos de EE. UU.; acepta un 1 inicial. */
export function normalizeUsPhone(value) {
  let digits = digitsOnly(value);
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

export function formatUsPhone(value) {
  const d = normalizeUsPhone(value).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/* Devuelve { field: mensaje } con los errores encontrados. */
export function validateLead({ service, name, phone, zipCode }) {
  const errors = {};

  if (!SERVICE_VALUES.includes(service)) {
    errors.service = "Selecciona el servicio que deseas revisar.";
  }

  const n = cleanName(name);
  if (!n) {
    errors.name = "Ingresa tu nombre.";
  } else if (n.length < 2 || !/\p{L}/u.test(n)) {
    errors.name = "Ingresa un nombre válido.";
  } else if (n.length > 80) {
    errors.name = "El nombre es demasiado largo.";
  }

  const p = normalizeUsPhone(phone);
  if (!p) {
    errors.phone = "Ingresa tu número de teléfono.";
  } else if (p.length !== 10 || /^[01]/.test(p)) {
    errors.phone = "Ingresa un teléfono válido de 10 dígitos.";
  }

  const z = digitsOnly(zipCode);
  if (!z) {
    errors.zipCode = "Ingresa tu ZIP Code.";
  } else if (z.length !== 5) {
    errors.zipCode = "Ingresa un ZIP Code válido de 5 dígitos.";
  }

  return errors;
}
