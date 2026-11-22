import { DEFAULT_WHATSAPP_MESSAGE, WHATSAPP_NUMBER } from "../config.js";

export function buildWhatsAppUrl(message = DEFAULT_WHATSAPP_MESSAGE) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildLeadWhatsAppMessage({ name, service, zipCode }) {
  return [
    "Hola, vi Vínculos 360.",
    "",
    `Mi nombre es: ${name}`,
    `Estoy interesado en: ${service}`,
    `ZIP Code: ${zipCode}`,
    "",
    "Quisiera información sobre opciones disponibles para mi hogar.",
  ].join("\n");
}
