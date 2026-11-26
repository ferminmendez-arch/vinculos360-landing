/* =========================================================
   TEXTOS DEL CHATBOT — ESPAÑOL E INGLÉS
   Las respuestas se guardan como códigos (api/src/lib/rules.js);
   aquí solo están las etiquetas visibles.
   Si cambias el texto de consentimiento, sube CONSENT_VERSION en
   api/src/lib/rules.js.
========================================================= */

import { PHONE_DISPLAY } from "../../config.js";

/* Algunas preguntas cambian si el servicio es para un negocio. */
const isBusiness = (answers = {}) => answers.property === "negocio";

const METHOD_ES = { whatsapp: "WhatsApp", llamada: "llamada", texto: "mensaje de texto", correo: "correo electrónico" };
const METHOD_EN = { whatsapp: "WhatsApp", llamada: "phone call", texto: "text message", correo: "email" };

const es = {
  launcher: "Habla con nosotros",
  launcherShort: "Chat",
  title: "Asistente de Vínculos 360",
  subtitle: "Toma menos de 2 minutos",
  close: "Cerrar chat",
  back: "Atrás",
  restart: "Empezar de nuevo",
  you: "Tú",
  bot: "Vínculos 360",
  greeting: "¡Hola! 👋 Te ayudo a revisar opciones de servicios para tu hogar. Son unas pocas preguntas.",
  serviceQuestion: "¿Qué servicio te interesa?",
  services: {
    electricidad: "Electricidad y ahorro",
    internet: "Internet para el hogar",
    seguridad: "Seguridad del hogar",
    otros: "Otros servicios",
  },
  questions: {
    property: { text: "¿Es para tu casa o para un negocio?", options: { casa: "Para mi casa", negocio: "Para un negocio" } },
    decision: {
      text: (a) => `¿Eres tú quien decide sobre este servicio en ${isBusiness(a) ? "tu negocio" : "tu hogar"}?`,
      options: { si: "Sí, yo decido", compartida: "Lo decido con alguien más", no: "No, decide otra persona" },
    },
    bill: {
      text: (a) => `Aproximadamente, ¿cuánto paga${isBusiness(a) ? " tu negocio" : "s"} al mes de energía eléctrica?`,
      options: { menos100: "Menos de $100", "100a200": "Entre $100 y $200", mas200: "Más de $200", nose: "No estoy seguro" },
    },
    contract: {
      text: (a) => `¿${isBusiness(a) ? "Tu negocio tiene" : "Tienes"} un contrato de energía eléctrica vigente?`,
      options: {
        sincontrato: "No / pago mes a mes",
        vencepronto: "Sí, vence en menos de 2 meses",
        vencedespues: "Sí, vence más adelante",
        nose: "No estoy seguro",
      },
    },
    situation: {
      text: "¿Cuál es tu situación con el internet?",
      options: { sinservicio: "No tengo internet", mejorar: "Quiero mejor velocidad o precio", mudanza: "Me estoy mudando", otra: "Otra situación" },
    },
    usage: {
      text: (a) => (isBusiness(a) ? "¿Para qué usan más el internet en tu negocio?" : "¿Para qué usan más el internet en casa?"),
      options: (a) =>
        isBusiness(a)
          ? { trabajo: "Operación del negocio y cobros", streaming: "Videollamadas y contenido en línea", basico: "Uso básico (correo, redes)" }
          : { trabajo: "Trabajo o estudio desde casa", streaming: "Películas, series y juegos", basico: "Uso básico (redes, correo)" },
    },
    housing: {
      text: "¿En qué tipo de vivienda vives?",
      options: { propia: "Casa propia", rentada: "Casa rentada", apartamento: "Apartamento" },
    },
    interest: {
      text: "¿Qué te interesa más?",
      options: { camaras: "Cámaras", monitoreo: "Monitoreo / alarma", ambos: "Ambos", nosegura: "Aún no estoy seguro" },
    },
    timeline: {
      text: "¿Para cuándo lo necesitas?",
      options: { pronto: "Lo antes posible", "1a3meses": "En 1 a 3 meses", explorando: "Solo estoy explorando" },
    },
    otherType: {
      text: "¿Qué otro servicio te interesa?",
      options: { movil: "Telefonía celular", fija: "Teléfono de casa", otro: "Otro servicio del hogar" },
    },
  },
  zipQuestion: (a) => `¿Cuál es el ZIP Code de ${isBusiness(a) ? "tu negocio" : "tu casa"}? Así revisamos qué opciones hay en tu zona.`,
  nameQuestion: "¿Cómo te llamas?",
  contactQuestion: (name) => `Gracias, ${name}. ¿Cómo prefieres que te contactemos?`,
  methods: { whatsapp: "WhatsApp", llamada: "Llamada", texto: "Mensaje de texto", correo: "Correo electrónico" },
  phoneQuestion: (method) =>
    method === "correo" ? "¿Y un número de teléfono por si necesitamos confirmar algo?" : "¿A qué número te contactamos?",
  emailQuestion: "¿Cuál es tu correo electrónico?",
  placeholders: { zip: "77494", name: "Tu nombre", phone: "(281) 555-1234", email: "tucorreo@ejemplo.com" },
  labels: { zip: "ZIP Code", name: "Nombre", phone: "Teléfono", email: "Correo electrónico" },
  send: "Enviar",
  consentQuestion: "Último paso: revisa y confirma.",
  consentText: (method) =>
    `Acepto que Vínculos 360 me contacte sobre esta solicitud por ${METHOD_ES[method] || "teléfono"} y, si hace falta, por llamada o mensaje de texto al número que proporcioné. Pueden aplicar tarifas de mensajes y datos. Aceptar no es condición para contratar ningún servicio y puedo pedir que no me contacten en cualquier momento.`,
  privacy: `Usamos tus datos solo para atender esta solicitud y comunicarnos contigo. Para pedir que los borremos, escríbenos por WhatsApp o llama al ${PHONE_DISPLAY}.`,
  independent: "Somos representantes independientes; no somos una compañía de electricidad, internet ni seguridad.",
  submit: "Enviar mi solicitud",
  sending: "Enviando…",
  consentRequired: "Marca la casilla para poder enviar tu solicitud.",
  successTitle: (name) => `¡Listo, ${name}! Recibimos tu solicitud.`,
  successText: (method) => `Te contactaremos por ${METHOD_ES[method] || "teléfono"} para revisar tus opciones.`,
  continueWhatsapp: "Continuar por WhatsApp ahora",
  offlineTitle: "Parece que no tienes conexión a internet.",
  rejectedTitle: "No pudimos registrar tu solicitud en este momento.",
  failedText: "Tus respuestas siguen aquí. Intenta de nuevo o envíanos tu solicitud por WhatsApp.",
  retry: "Intentar de nuevo",
  sendByWhatsapp: "Enviar mi solicitud por WhatsApp",
  unverifiedTitle: "Enviamos tus datos, pero no pudimos confirmar que se registraron.",
  unverifiedText: "Para asegurarnos de atenderte, continúa por WhatsApp: tus datos van incluidos en el mensaje.",
  errors: {
    zip_required: "Escribe tu ZIP Code.",
    zip_invalid: "Escribe un ZIP Code válido de 5 dígitos.",
    name_required: "Escribe tu nombre.",
    name_invalid: "Escribe un nombre válido.",
    name_long: "El nombre es demasiado largo.",
    phone_required: "Escribe tu número de teléfono.",
    phone_invalid: "Escribe un teléfono válido de 10 dígitos.",
    email_required: "Escribe tu correo electrónico.",
    email_invalid: "Escribe un correo electrónico válido.",
  },
  whatsappMessage: ({ name, service, zipCode, method }) =>
    [
      "Hola, vi Vínculos 360 y usé el chat del sitio.",
      "",
      `Mi nombre es: ${name}`,
      `Me interesa: ${service}`,
      `ZIP Code: ${zipCode}`,
      `Prefiero que me contacten por: ${METHOD_ES[method] || method}`,
    ].join("\n"),
};

const en = {
  launcher: "Chat with us",
  launcherShort: "Chat",
  title: "Vínculos 360 Assistant",
  subtitle: "Takes less than 2 minutes",
  close: "Close chat",
  back: "Back",
  restart: "Start over",
  you: "You",
  bot: "Vínculos 360",
  greeting: "Hi! 👋 I can help you review service options for your home. Just a few quick questions.",
  serviceQuestion: "Which service are you interested in?",
  services: {
    electricidad: "Electricity & savings",
    internet: "Home internet",
    seguridad: "Home security",
    otros: "Other services",
  },
  questions: {
    property: { text: "Is it for your home or for a business?", options: { casa: "For my home", negocio: "For a business" } },
    decision: {
      text: (a) => `Are you the one who decides on this service for ${isBusiness(a) ? "your business" : "your home"}?`,
      options: { si: "Yes, I decide", compartida: "I decide with someone else", no: "No, someone else decides" },
    },
    bill: {
      text: (a) => `About how much is ${isBusiness(a) ? "your business's" : "your"} monthly electric bill?`,
      options: { menos100: "Less than $100", "100a200": "Between $100 and $200", mas200: "More than $200", nose: "Not sure" },
    },
    contract: {
      text: (a) => (isBusiness(a) ? "Does your business currently have an electricity contract?" : "Do you currently have an electricity contract?"),
      options: {
        sincontrato: "No / month-to-month",
        vencepronto: "Yes, it ends in less than 2 months",
        vencedespues: "Yes, it ends later",
        nose: "Not sure",
      },
    },
    situation: {
      text: "What's your internet situation?",
      options: { sinservicio: "I don't have internet", mejorar: "I want better speed or price", mudanza: "I'm moving", otra: "Something else" },
    },
    usage: {
      text: (a) => (isBusiness(a) ? "What does your business use the internet for most?" : "What do you use the internet for most at home?"),
      options: (a) =>
        isBusiness(a)
          ? { trabajo: "Running the business and payments", streaming: "Video calls and online content", basico: "Basic use (email, social media)" }
          : { trabajo: "Working or studying from home", streaming: "Movies, shows and gaming", basico: "Basic use (social media, email)" },
    },
    housing: {
      text: "What type of home do you live in?",
      options: { propia: "House I own", rentada: "House I rent", apartamento: "Apartment" },
    },
    interest: {
      text: "What interests you most?",
      options: { camaras: "Cameras", monitoreo: "Monitoring / alarm", ambos: "Both", nosegura: "Not sure yet" },
    },
    timeline: {
      text: "When do you need it?",
      options: { pronto: "As soon as possible", "1a3meses": "In 1 to 3 months", explorando: "Just exploring" },
    },
    otherType: {
      text: "Which other service are you interested in?",
      options: { movil: "Cell phone service", fija: "Home phone", otro: "Another home service" },
    },
  },
  zipQuestion: (a) => `What's ${isBusiness(a) ? "your business's" : "your home"} ZIP Code? That way we can check the options in your area.`,
  nameQuestion: "What's your name?",
  contactQuestion: (name) => `Thanks, ${name}. How would you prefer we contact you?`,
  methods: { whatsapp: "WhatsApp", llamada: "Phone call", texto: "Text message", correo: "Email" },
  phoneQuestion: (method) =>
    method === "correo" ? "And a phone number in case we need to confirm something?" : "What number should we contact you at?",
  emailQuestion: "What's your email address?",
  placeholders: { zip: "77494", name: "Your name", phone: "(281) 555-1234", email: "you@example.com" },
  labels: { zip: "ZIP Code", name: "Name", phone: "Phone", email: "Email" },
  send: "Send",
  consentQuestion: "Last step: review and confirm.",
  consentText: (method) =>
    `I agree that Vínculos 360 may contact me about this request by ${METHOD_EN[method] || "phone"} and, if needed, by phone call or text message at the number I provided. Message and data rates may apply. Agreeing is not a condition of purchasing any service, and I can ask not to be contacted at any time.`,
  privacy: `We use your information only to handle this request and to contact you. To ask us to delete it, message us on WhatsApp or call ${PHONE_DISPLAY}.`,
  independent: "We are independent representatives; we are not an electricity, internet or security company.",
  submit: "Send my request",
  sending: "Sending…",
  consentRequired: "Check the box to send your request.",
  successTitle: (name) => `All set, ${name}! We received your request.`,
  successText: (method) => `We'll contact you by ${METHOD_EN[method] || "phone"} to review your options.`,
  continueWhatsapp: "Continue on WhatsApp now",
  offlineTitle: "It looks like you're offline.",
  rejectedTitle: "We couldn't register your request right now.",
  failedText: "Your answers are still here. Try again or send us your request on WhatsApp.",
  retry: "Try again",
  sendByWhatsapp: "Send my request on WhatsApp",
  unverifiedTitle: "We sent your details, but couldn't confirm they were registered.",
  unverifiedText: "To make sure we can help you, continue on WhatsApp: your details are included in the message.",
  errors: {
    zip_required: "Enter your ZIP Code.",
    zip_invalid: "Enter a valid 5-digit ZIP Code.",
    name_required: "Enter your name.",
    name_invalid: "Enter a valid name.",
    name_long: "That name is too long.",
    phone_required: "Enter your phone number.",
    phone_invalid: "Enter a valid 10-digit phone number.",
    email_required: "Enter your email address.",
    email_invalid: "Enter a valid email address.",
  },
  whatsappMessage: ({ name, service, zipCode, method }) =>
    [
      "Hi, I saw Vínculos 360 and used the chat on the website.",
      "",
      `My name is: ${name}`,
      `I'm interested in: ${service}`,
      `ZIP Code: ${zipCode}`,
      `Preferred contact: ${METHOD_EN[method] || method}`,
    ].join("\n"),
};

export const CHAT_STRINGS = { es, en };

/* Texto de una pregunta (o del ZIP) según las respuestas anteriores. */
export function resolveText(value, answers = {}) {
  return typeof value === "function" ? value(answers) : value;
}
