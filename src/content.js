/* =========================================================
   DATOS ESTRUCTURALES DEL SITIO
   Los textos visibles están en src/i18n.js (español e inglés).
   Los valores de `value` en SERVICES se guardan tal cual en la hoja
   de Google Sheets, en español, sin importar el idioma del visitante.
   No los cambies sin actualizar los reportes que dependen de ellos.
========================================================= */

export const SECTION_IDS = ["inicio", "servicios", "como-funciona", "testimonios", "contacto"];

export const SERVICES = [
  { value: "Electricidad", slug: "electricidad", tone: "orange", image: "/img/ilustraciones/electricidad.svg" },
  { value: "Internet", slug: "internet", tone: "blue", image: "/img/ilustraciones/internet.svg" },
  { value: "Seguridad y monitoreo", slug: "seguridad", tone: "navy", image: "/img/ilustraciones/seguridad.svg" },
  { value: "Otros servicios", slug: "otros", tone: "green", image: "/img/ilustraciones/otros.svg" },
];

export const STEP_NUMBERS = ["01", "02", "03", "04"];

export const TESTIMONIAL_PEOPLE = [
  { name: "María G.", location: "Houston, TX", stars: 5 },
  { name: "Hector H.", location: "Pecos, TX", stars: 5 },
  { name: "Ana L.", location: "Austin, TX", stars: 5 },
];

/* Acepta ?service=electricidad | internet | otros (y variantes en inglés). */
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
  if (["seguridad", "seguridad y monitoreo", "monitoreo", "camaras", "camara", "security", "cameras", "monitoring"].includes(normalized))
    return "Seguridad y monitoreo";
  if (["otros", "otros servicios", "otro", "otros-servicios", "other", "others", "other services"].includes(normalized))
    return "Otros servicios";
  return "";
}
