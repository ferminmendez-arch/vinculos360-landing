import { WHATSAPP_NUMBER } from "../config.js";
import { STRINGS } from "../i18n.js";

export function buildWhatsAppUrl(message = STRINGS.es.whatsapp.default) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/* `service` es la etiqueta visible en el idioma del visitante. */
export function buildLeadWhatsAppMessage({ name, service, zipCode }, lang = "es") {
  return (STRINGS[lang] || STRINGS.es).whatsapp.lead({ name, service, zipCode });
}
