/* =========================================================
   TEXTOS DEL SITIO — ESPAÑOL (principal) E INGLÉS
   Español: /      Inglés: /en/
========================================================= */

import { createContext, use } from "react";

export { LANGS, alternateUrl, langFromPath } from "./lib/lang.js";

const es = {
  langName: "Español",
  switchTo: { label: "English", short: "EN", title: "View this site in English" },
  skip: "Saltar al contenido",
  homeLabel: "Vínculos 360 — Inicio",
  nav: {
    inicio: "Inicio",
    servicios: "Servicios",
    "como-funciona": "Cómo funciona",
    testimonios: "Testimonios",
    contacto: "Contacto",
  },
  navLabel: "Principal",
  mobileNavLabel: "Menú móvil",
  openMenu: "Abrir menú",
  closeMenu: "Cerrar menú",
  callUs: (phone) => `Llamar al ${phone}`,
  whatsappPrefix: "Escríbenos por ",
  newTab: "(se abre en una nueva pestaña)",
  tagline: "Conectamos lo que te importa",

  hero: {
    badge: "Electricidad · Internet · Seguridad · Otros servicios",
    titleStart: "Los servicios esenciales de tu hogar,",
    titleHighlight: "en un solo lugar",
    text: "Te ayudamos a comparar opciones de electricidad, internet, seguridad y otros servicios esenciales para encontrar lo que mejor se adapte a las necesidades de tu hogar.",
    primary: "Ver mis opciones",
    whatsapp: "Hablar por WhatsApp",
    imageAlt: "Familia sonriente revisando la factura de luz de su hogar",
  },
  benefits: ["Atención personalizada", "Orientación sin compromiso", "Proceso rápido y sencillo"],

  services: {
    eyebrow: "Servicios",
    title: "¿Qué servicio necesitas?",
    text: "Selecciona el servicio que deseas revisar y te llevamos directo al formulario.",
    select: "Seleccionar",
    selected: "Seleccionado — continuar",
    items: {
      electricidad: {
        title: "Electricidad",
        description:
          "Revisa opciones de electricidad disponibles para tu hogar y conoce alternativas que se adapten a tus necesidades.",
      },
      internet: {
        title: "Internet",
        description: "Encuentra opciones de conexión para tu hogar según disponibilidad, velocidad y necesidades de uso.",
      },
      seguridad: {
        title: "Seguridad y monitoreo",
        description:
          "Protege tu hogar con cámaras de seguridad y monitoreo. Te orientamos para elegir la opción que mejor se adapte a tu casa.",
      },
      otros: {
        title: "Otros servicios",
        description: "También podemos orientarte sobre telefonía y otros servicios esenciales para tu hogar.",
      },
    },
  },

  steps: {
    eyebrow: "Cómo funciona",
    title: "Un proceso simple, claro y sin complicaciones",
    text: "Te guiamos paso a paso para que puedas conocer tus opciones y tomar una decisión con confianza.",
    stepLabel: "Paso ",
    items: [
      { title: "Cuéntanos qué necesitas", description: "Selecciona el servicio que deseas revisar y comparte tus datos básicos." },
      { title: "Revisamos tus opciones", description: "Analizamos alternativas disponibles de acuerdo con tus necesidades." },
      { title: "Te guiamos paso a paso", description: "Te explicamos las opciones de forma clara para que puedas comparar." },
      { title: "Elige la mejor opción para ti", description: "Tú decides qué servicio se adapta mejor a las necesidades de tu hogar." },
    ],
  },

  testimonials: {
    eyebrow: "Testimonios",
    title: "Una atención clara y personalizada",
    text: "Experiencias de personas que buscaban entender mejor sus opciones de servicios para el hogar.",
    stars: (n) => `${n} de 5 estrellas`,
    note: "",
    quotes: [
      "Me ayudaron a entender mejor mis opciones y el proceso fue mucho más sencillo de lo que esperaba.",
      "El proceso fue rápido, claro y muy profesional. Excelente atención desde el primer mensaje.",
      "Me encantó que todo se explicó de forma sencilla y pude comparar opciones con más confianza.",
    ],
  },

  contact: {
    eyebrow: "Contacto",
    title: "Cuéntanos qué servicio necesitas",
    text: "Completa tus datos y continuaremos la conversación por WhatsApp.",
    whatsapp: "Escríbenos por WhatsApp",
    illustrationAlt: "",
    serviceLegend: "¿Qué servicio deseas revisar?",
    name: "Nombre",
    namePlaceholder: "Tu nombre",
    phone: "Teléfono",
    zip: "ZIP Code",
    honeypot: "Empresa",
    submit: "Continuar por WhatsApp",
    sending: "Enviando tu solicitud…",
    retry: "Intentar de nuevo",
    privacy:
      "Al continuar, utilizaremos esta información para atender tu solicitud y continuar la conversación contigo.",
    successTitle: "¡Recibimos tu solicitud!",
    successText: "Te estamos llevando a WhatsApp para continuar la conversación.",
    openWhatsapp: "Abrir WhatsApp",
    another: "Enviar otra solicitud",
    offlineTitle: "Parece que no tienes conexión a internet.",
    rejectedTitle: "No pudimos registrar tu solicitud en este momento.",
    failedText:
      "Tus datos siguen aquí. Intenta de nuevo o envíanos tu solicitud directamente por WhatsApp. Si no se envía ahora, la reintentaremos automáticamente la próxima vez que visites el sitio desde este dispositivo.",
    sendByWhatsapp: "Enviar mi solicitud por WhatsApp",
    unverifiedTitle: "Enviamos tus datos, pero no pudimos confirmar que se registraron.",
    unverifiedText:
      "Para asegurarnos de atenderte, continúa por WhatsApp: tu nombre, servicio y ZIP Code van incluidos en el mensaje.",
  },

  errors: {
    service_required: "Selecciona el servicio que deseas revisar.",
    name_required: "Ingresa tu nombre.",
    name_invalid: "Ingresa un nombre válido.",
    name_long: "El nombre es demasiado largo.",
    phone_required: "Ingresa tu número de teléfono.",
    phone_invalid: "Ingresa un teléfono válido de 10 dígitos.",
    zip_required: "Ingresa tu ZIP Code.",
    zip_invalid: "Ingresa un ZIP Code válido de 5 dígitos.",
  },

  footer: {
    about: "Conectamos lo que te importa. Te ayudamos a comparar opciones de servicios esenciales para tu hogar.",
    navTitle: "Navegación",
    navLabel: "Pie de página",
    contactTitle: "Contacto",
    rights: "Todos los derechos reservados.",
  },

  mobileBar: { call: "Llamar", request: "Solicitar ayuda" },

  whatsapp: {
    default: "Hola, vi Vínculos 360 y quisiera información sobre servicios para mi hogar.",
    lead: ({ name, service, zipCode }) =>
      [
        "Hola, vi Vínculos 360.",
        "",
        `Mi nombre es: ${name}`,
        `Estoy interesado en: ${service}`,
        `ZIP Code: ${zipCode}`,
        "",
        "Quisiera información sobre opciones disponibles para mi hogar.",
      ].join("\n"),
  },
};

const en = {
  langName: "English",
  switchTo: { label: "Español", short: "ES", title: "Ver este sitio en español" },
  skip: "Skip to content",
  homeLabel: "Vínculos 360 — Home",
  nav: {
    inicio: "Home",
    servicios: "Services",
    "como-funciona": "How it works",
    testimonios: "Testimonials",
    contacto: "Contact",
  },
  navLabel: "Main",
  mobileNavLabel: "Mobile menu",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  callUs: (phone) => `Call ${phone}`,
  whatsappPrefix: "Message us on ",
  newTab: "(opens in a new tab)",
  tagline: "Connecting what matters to you",

  hero: {
    badge: "Electricity · Internet · Security · Other services",
    titleStart: "Your home's essential services,",
    titleHighlight: "all in one place",
    text: "We help you compare electricity, internet, security and other essential service options to find what best fits your home's needs.",
    primary: "See my options",
    whatsapp: "Chat on WhatsApp",
    imageAlt: "Smiling family reviewing their home electricity bill",
  },
  benefits: ["Personalized attention", "No-obligation guidance", "Quick and simple process"],

  services: {
    eyebrow: "Services",
    title: "What service do you need?",
    text: "Choose the service you want to review and we'll take you straight to the form.",
    select: "Select",
    selected: "Selected — continue",
    items: {
      electricidad: {
        title: "Electricity",
        description: "Review the electricity options available for your home and find alternatives that fit your needs.",
      },
      internet: {
        title: "Internet",
        description: "Find connection options for your home based on availability, speed and how you use it.",
      },
      seguridad: {
        title: "Security & monitoring",
        description:
          "Protect your home with security cameras and monitoring. We'll help you choose the option that best fits your home.",
      },
      otros: {
        title: "Other services",
        description: "We can also guide you on phone service and other essential services for your home.",
      },
    },
  },

  steps: {
    eyebrow: "How it works",
    title: "A simple, clear and hassle-free process",
    text: "We guide you step by step so you can understand your options and decide with confidence.",
    stepLabel: "Step ",
    items: [
      { title: "Tell us what you need", description: "Choose the service you want to review and share your basic details." },
      { title: "We review your options", description: "We look at the available alternatives based on your needs." },
      { title: "We guide you step by step", description: "We explain your options clearly so you can compare them." },
      { title: "Choose what's best for you", description: "You decide which service best fits your home's needs." },
    ],
  },

  testimonials: {
    eyebrow: "Testimonials",
    title: "Clear, personalized attention",
    text: "Experiences from people who wanted to better understand their home service options.",
    stars: (n) => `${n} out of 5 stars`,
    note: "Testimonials translated from Spanish.",
    quotes: [
      "They helped me better understand my options, and the process was much simpler than I expected.",
      "The process was fast, clear and very professional. Excellent service from the very first message.",
      "I loved that everything was explained simply and I could compare options with more confidence.",
    ],
  },

  contact: {
    eyebrow: "Contact",
    title: "Tell us what service you need",
    text: "Fill in your details and we'll continue the conversation on WhatsApp.",
    whatsapp: "Message us on WhatsApp",
    illustrationAlt: "",
    serviceLegend: "Which service would you like to review?",
    name: "Name",
    namePlaceholder: "Your name",
    phone: "Phone",
    zip: "ZIP Code",
    honeypot: "Company",
    submit: "Continue on WhatsApp",
    sending: "Sending your request…",
    retry: "Try again",
    privacy: "By continuing, we'll use this information to handle your request and continue the conversation with you.",
    successTitle: "We received your request!",
    successText: "We're taking you to WhatsApp to continue the conversation.",
    openWhatsapp: "Open WhatsApp",
    another: "Send another request",
    offlineTitle: "It looks like you're offline.",
    rejectedTitle: "We couldn't register your request right now.",
    failedText:
      "Your details are still here. Try again or send us your request directly on WhatsApp. If it can't be sent now, we'll retry automatically the next time you visit the site from this device.",
    sendByWhatsapp: "Send my request on WhatsApp",
    unverifiedTitle: "We sent your details, but couldn't confirm they were registered.",
    unverifiedText:
      "To make sure we can help you, continue on WhatsApp: your name, service and ZIP Code are included in the message.",
  },

  errors: {
    service_required: "Choose the service you want to review.",
    name_required: "Enter your name.",
    name_invalid: "Enter a valid name.",
    name_long: "That name is too long.",
    phone_required: "Enter your phone number.",
    phone_invalid: "Enter a valid 10-digit phone number.",
    zip_required: "Enter your ZIP Code.",
    zip_invalid: "Enter a valid 5-digit ZIP Code.",
  },

  footer: {
    about: "Connecting what matters to you. We help you compare essential service options for your home.",
    navTitle: "Navigation",
    navLabel: "Footer",
    contactTitle: "Contact",
    rights: "All rights reserved.",
  },

  mobileBar: { call: "Call", request: "Get help" },

  whatsapp: {
    default: "Hi, I saw Vínculos 360 and I'd like information about services for my home.",
    lead: ({ name, service, zipCode }) =>
      [
        "Hi, I saw Vínculos 360.",
        "",
        `My name is: ${name}`,
        `I'm interested in: ${service}`,
        `ZIP Code: ${zipCode}`,
        "",
        "I'd like information about available options for my home.",
      ].join("\n"),
  },
};

export const STRINGS = { es, en };

export const LangContext = createContext("es");

export function useLang() {
  return use(LangContext);
}

export function useStrings() {
  return STRINGS[use(LangContext)] || es;
}
