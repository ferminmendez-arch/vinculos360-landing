/* =========================================================
   CONTENIDO DEL SITIO
   Textos aprobados. Los valores de `value` en SERVICES se guardan
   tal cual en la hoja de Google Sheets: no los cambies sin
   actualizar los reportes que dependen de ellos.
========================================================= */

export const NAV_LINKS = [
  { href: "#inicio", label: "Inicio" },
  { href: "#servicios", label: "Servicios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#testimonios", label: "Testimonios" },
  { href: "#contacto", label: "Contacto" },
];

export const MINI_BENEFITS = [
  "Atención personalizada",
  "Orientación sin compromiso",
  "Proceso rápido y sencillo",
];

export const SERVICES = [
  {
    value: "Electricidad",
    slug: "electricidad",
    title: "Electricidad",
    description:
      "Revisa opciones de electricidad disponibles para tu hogar y conoce alternativas que se adapten a tus necesidades.",
    tone: "orange",
  },
  {
    value: "Internet",
    slug: "internet",
    title: "Internet",
    description:
      "Encuentra opciones de conexión para tu hogar según disponibilidad, velocidad y necesidades de uso.",
    tone: "blue",
  },
  {
    value: "Otros servicios",
    slug: "otros",
    title: "Otros servicios",
    description:
      "También podemos orientarte sobre telefonía, seguridad y otros servicios esenciales para tu hogar.",
    tone: "green",
  },
];

export const STEPS = [
  {
    number: "01",
    title: "Cuéntanos qué necesitas",
    description:
      "Selecciona el servicio que deseas revisar y comparte tus datos básicos.",
  },
  {
    number: "02",
    title: "Revisamos tus opciones",
    description:
      "Analizamos alternativas disponibles de acuerdo con tus necesidades.",
  },
  {
    number: "03",
    title: "Te guiamos paso a paso",
    description:
      "Te explicamos las opciones de forma clara para que puedas comparar.",
  },
  {
    number: "04",
    title: "Elige la mejor opción para ti",
    description:
      "Tú decides qué servicio se adapta mejor a las necesidades de tu hogar.",
  },
];

export const TESTIMONIALS = [
  {
    name: "María G.",
    location: "Houston, TX",
    text: "Me ayudaron a entender mejor mis opciones y el proceso fue mucho más sencillo de lo que esperaba.",
    stars: 5,
  },
  {
    name: "Hector H.",
    location: "Pecos, TX",
    text: "El proceso fue rápido, claro y muy profesional. Excelente atención desde el primer mensaje.",
    stars: 5,
  },
  {
    name: "Ana L.",
    location: "Austin, TX",
    text: "Me encantó que todo se explicó de forma sencilla y pude comparar opciones con más confianza.",
    stars: 5,
  },
];

/* Acepta ?service=electricidad | internet | otros (y variantes). */
export function serviceFromQuery(search) {
  const raw = new URLSearchParams(search).get("service");
  if (!raw) return "";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (["electricidad", "luz", "electricity"].includes(normalized)) return "Electricidad";
  if (normalized === "internet") return "Internet";
  if (["otros", "otros servicios", "otro", "otros-servicios"].includes(normalized))
    return "Otros servicios";
  return "";
}
