/* =========================================================
   DATOS ESTRUCTURALES DEL SITIO
   Los textos visibles están en src/i18n.js (español e inglés).
   Los valores de `value` en SERVICES se guardan tal cual en la hoja
   de Google Sheets, en español, sin importar el idioma del visitante.
   No los cambies sin actualizar los reportes que dependen de ellos.
========================================================= */

export const SECTION_IDS = ["inicio", "servicios", "como-funciona", "testimonios", "contacto"];

/* Los servicios con `image` son las tarjetas grandes; los demás aparecen
   en la fila compacta "También te ayudamos con". El formulario y el chat
   muestran todos. */
export const SERVICES = [
  { value: "Electricidad", slug: "electricidad", tone: "orange", image: "/img/ilustraciones/electricidad.svg" },
  { value: "Internet", slug: "internet", tone: "blue", image: "/img/ilustraciones/internet.svg" },
  { value: "Seguridad y monitoreo", slug: "seguridad", tone: "navy", image: "/img/ilustraciones/seguridad.svg" },
  { value: "Televisión", slug: "television", tone: "blue" },
  { value: "Telefonía celular", slug: "celular", tone: "orange" },
  { value: "Protección de identidad", slug: "identidad", tone: "navy" },
  { value: "Procesamiento de pagos", slug: "pagos", tone: "green" },
  { value: "Otros servicios", slug: "otros", tone: "green", image: "/img/ilustraciones/otros.svg" },
];

export const STEP_NUMBERS = ["01", "02", "03", "04"];

export const TESTIMONIAL_PEOPLE = [
  { name: "María G.", location: "Houston, TX", stars: 5 },
  { name: "Hector H.", location: "Pecos, TX", stars: 5 },
  { name: "Ana L.", location: "Austin, TX", stars: 5 },
];

/* Acepta ?service=electricidad | internet | seguridad | tv | celular | identidad | pagos | otros (y variantes en inglés). */
export function serviceFromQuery(search) {
  const raw = new URLSearchParams(search).get("service");
  if (!raw) return "";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (["electricidad", "luz", "electricity", "power"].includes(normalized)) return "Electricidad";
  if (normalized === "internet") return "Internet";
  if (["tv", "television", "cable", "satelite"].includes(normalized)) return "Televisión";
  if (["celular", "movil", "telefonia celular", "mobile", "cell", "wireless"].includes(normalized)) return "Telefonía celular";
  if (["identidad", "proteccion de identidad", "identity", "id"].includes(normalized)) return "Protección de identidad";
  if (["pagos", "procesamiento de pagos", "payments", "payment processing", "tarjetas"].includes(normalized)) return "Procesamiento de pagos";
  if (["seguridad", "seguridad y monitoreo", "monitoreo", "camaras", "camara", "security", "cameras", "monitoring"].includes(normalized))
    return "Seguridad y monitoreo";
  if (["otros", "otros servicios", "otro", "otros-servicios", "other", "others", "other services"].includes(normalized))
    return "Otros servicios";
  return "";
}
