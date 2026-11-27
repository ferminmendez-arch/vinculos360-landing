/* =========================================================
   TEXTOS DEL ANALIZADOR DE FACTURA — ESPAÑOL E INGLÉS
   Reglas: "energía eléctrica" (no "luz"), sin nombres de proveedores,
   sin promesas de ahorro, sin precios de planes. Cada dato público
   lleva su fuente.
========================================================= */

const fmtCents = (n, lang) =>
  `${Number(n).toLocaleString(lang === "en" ? "en-US" : "es-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}¢`;

const fmtDate = (iso, lang) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-US" : "es-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const es = {
  nav: "Analiza tu factura",
  eyebrow: "Calculadora rápida",
  title: "¿Cuánto pagas realmente por cada kWh?",
  text: "Con dos datos de tu última factura de energía eléctrica calculamos tu costo promedio efectivo por kWh y lo comparamos con el promedio residencial de Texas. No te pedimos nombre ni teléfono para ver el resultado.",
  formLabel: "Analizador de factura de energía eléctrica",
  bill: "Total del servicio eléctrico del mes ($)",
  billHelp: "Usa los cargos del periodo, sin saldo anterior ni recargos por pago tardío.",
  kwh: "Consumo del mes (kWh)",
  kwhHelp: "Aparece en tu factura como “kWh usados” o “consumo”.",
  zip: "Código postal (ZIP)",
  zipHelp: "Para saber si en tu zona puedes elegir proveedor.",
  contractEnd: "Fecha de vencimiento de tu contrato",
  optional: "opcional",
  contractHelp: "Suele aparecer en la factura o en el aviso de vencimiento.",
  submit: "Calcular mi costo por kWh",
  required: "obligatorio",
  errors: {
    bill_required: "Escribe el total del servicio eléctrico.",
    kwh_required: "Escribe los kWh del mes.",
    number_invalid: "Escribe solo números, por ejemplo 145.80.",
    bill_low: "El total parece muy bajo. Revisa la cantidad.",
    bill_high: "El total parece muy alto. Revisa la cantidad.",
    kwh_low: "El consumo parece muy bajo. Revisa los kWh.",
    kwh_high: "El consumo parece muy alto. Revisa los kWh.",
    rate_out_of_range: "Con estos datos el costo por kWh no es realista. Revisa el total y los kWh.",
    zip_required: "Escribe tu código postal.",
    zip_invalid: "El código postal debe tener 5 números.",
    date_invalid: "Revisa la fecha de vencimiento.",
  },
  errorSummary: "Revisa los datos marcados.",

  resultTitle: "Tu resultado",
  resultLabel: "Costo promedio efectivo",
  perKwh: "por kWh",
  average: (avg) => `Promedio residencial de Texas: ${fmtCents(avg.cents, "es")} por kWh (${avg.periodEs}).`,
  levels: {
    alta: (r) => ({
      title: `Pagas alrededor de ${r.diffPct}% más que el promedio de Texas`,
      text: "Vale la pena revisar tu plan. Una comparación con planes disponibles para tu código postal te dirá si hay una opción que te convenga más.",
    }),
    media: () => ({
      title: "Estás cerca del promedio de Texas",
      text: "Tu costo está dentro del rango típico. Aun así, si tu contrato vence pronto, conviene comparar antes de renovar.",
    }),
    baja: (r) => ({
      title: `Pagas alrededor de ${Math.abs(r.diffPct)}% menos que el promedio de Texas`,
      text: "Tu costo actual es bajo comparado con el promedio. Si tu contrato vence pronto, compara antes de renovar para no perder ese precio.",
    }),
  },
  disclaimer:
    "Este número es tu factura dividida entre los kWh: incluye cargos fijos, cargos de entrega de la distribuidora e impuestos. Por eso no es igual a la tarifa de tu contrato y puede variar mes a mes. Es una referencia, no una garantía de ahorro.",
  zones: {
    fuera_de_texas: "Por ahora solo revisamos energía eléctrica en Texas.",
    sin_opcion_probable:
      "En tu código postal es probable que el servicio lo dé una empresa municipal o cooperativa, y quizá no puedas elegir proveedor. Podemos confirmarlo en la revisión.",
    texas: "",
  },
  contract: {
    vencido: (c) =>
      `Tu contrato venció el ${fmtDate(c.date, "es")}. Si no elegiste un plan nuevo, podrías estar en un plan mensual o variable. Revisa tu factura.`,
    ventana: (c) =>
      `Tu contrato vence en ${c.days} ${c.days === 1 ? "día" : "días"}. Según la PUCT, desde 14 días antes del vencimiento puedes cambiar de plan sin cargo por cancelación anticipada.`,
    pronto: (c) =>
      `Tu contrato vence el ${fmtDate(c.date, "es")} (en ${c.days} días). Buen momento para comparar. Según la PUCT, puedes cambiar sin cargo por cancelación desde 14 días antes del vencimiento.`,
    despues: (c) =>
      `Tu contrato vence el ${fmtDate(c.date, "es")}. Cambiar antes podría tener un cargo por cancelación anticipada: revisa tu contrato (EFL y términos de servicio).`,
  },
  ctaTitle: "¿Quieres saber si hay un plan mejor para ti?",
  ctaText:
    "Te preparamos una comparación personalizada con planes disponibles para tu código postal. Usaremos los datos que ya escribiste; solo te pediremos cómo contactarte.",
  cta: "Solicitar comparación personalizada",
  ctaNote: "Sin compromiso. Nunca te pediremos tu número de Seguro Social ni tu identificación por chat o WhatsApp.",
  recalc: "Calcular con otra factura",
  sources: "Fuentes",
  sourceEia: "Promedio: U.S. Energy Information Administration (EIA-861M)",
  sourcePuct: "Vencimiento de contratos: Comisión de Servicios Públicos de Texas (PUCT)",
  share: {
    button: "Compartir la calculadora",
    whatsapp: "Enviar por WhatsApp",
    copied: "¡Enlace copiado!",
    title: "Calculadora de energía eléctrica",
    text: "¿Sabes cuánto pagas realmente por cada kWh de energía eléctrica? Calcúlalo en un minuto, sin dar tu nombre ni teléfono:",
  },
  reminder: {
    title: "¿Te avisamos antes de que venza tu contrato?",
    text: "Te escribimos por WhatsApp unas semanas antes del vencimiento, justo cuando puedes comparar y cambiar sin cargo por cancelación. Un solo aviso, sin compromiso.",
    open: "Sí, avísame",
    date: "Fecha de vencimiento de tu contrato",
    name: "Tu nombre",
    phone: "Tu WhatsApp",
    email: "Correo electrónico",
    optional: "opcional",
    consent:
      "Acepto que Vínculos 360 me envíe por WhatsApp (y por correo, si lo escribí) un recordatorio antes de que venza mi contrato de energía eléctrica y me contacte sobre ese recordatorio al número que proporcioné. Pueden aplicar tarifas de mensajes y datos. Aceptar no es condición para contratar ningún servicio y puedo pedir que no me contacten en cualquier momento.",
    submit: "Guardar mi recordatorio",
    sending: "Guardando…",
    success: (name, date) => `¡Listo, ${name}! Te avisaremos antes del ${date}.`,
    successNote: "Si quieres revisar tus opciones antes, escríbenos por WhatsApp cuando gustes.",
    rejected: "No pudimos guardar tu recordatorio. Inténtalo de nuevo en un momento.",
    offline: "Parece que no tienes conexión. Inténtalo de nuevo cuando vuelvas a estar en línea.",
    unverified: "No pudimos confirmar que se guardó. Para estar seguros, escríbenos por WhatsApp.",
    errors: {
      date_required: "Escribe la fecha de vencimiento.",
      date_invalid: "Revisa la fecha de vencimiento.",
      date_past: "Esa fecha ya pasó. Si tu contrato ya venció, mejor solicita la comparación personalizada.",
      name_required: "Escribe tu nombre.",
      name_invalid: "Escribe tu nombre (solo letras).",
      phone_required: "Escribe tu número de WhatsApp.",
      phone_invalid: "Escribe un número de 10 dígitos de EE. UU.",
      email_invalid: "Revisa el correo electrónico.",
      consent_required: "Marca la casilla para guardar tu recordatorio.",
    },
  },
  tipsTitle: "¿Dónde encuentro estos datos?",
  tips: [
    "El total del servicio eléctrico está en el resumen de cargos del periodo.",
    "Los kWh aparecen junto a la lectura del medidor o en “consumo”.",
    "La fecha de vencimiento aparece en tu factura o en el aviso que tu proveedor debe enviarte al menos 30 días antes.",
  ],
};

const en = {
  nav: "Analyze your bill",
  eyebrow: "Quick calculator",
  title: "How much do you really pay per kWh?",
  text: "With two numbers from your latest electricity bill, we calculate your average effective cost per kWh and compare it with the Texas residential average. You don't need to give your name or phone number to see the result.",
  formLabel: "Electricity bill analyzer",
  bill: "Electric service total for the month ($)",
  billHelp: "Use the charges for the period, without any previous balance or late fees.",
  kwh: "Usage for the month (kWh)",
  kwhHelp: "Shown on your bill as “kWh used” or “usage”.",
  zip: "ZIP code",
  zipHelp: "To know whether you can choose your provider in your area.",
  contractEnd: "Contract expiration date",
  optional: "optional",
  contractHelp: "Usually on your bill or in the expiration notice.",
  submit: "Calculate my cost per kWh",
  required: "required",
  errors: {
    bill_required: "Enter the electric service total.",
    kwh_required: "Enter the kWh for the month.",
    number_invalid: "Enter numbers only, for example 145.80.",
    bill_low: "That total looks very low. Please check it.",
    bill_high: "That total looks very high. Please check it.",
    kwh_low: "That usage looks very low. Please check the kWh.",
    kwh_high: "That usage looks very high. Please check the kWh.",
    rate_out_of_range: "With these numbers the cost per kWh isn't realistic. Please check the total and the kWh.",
    zip_required: "Enter your ZIP code.",
    zip_invalid: "The ZIP code must have 5 digits.",
    date_invalid: "Please check the expiration date.",
  },
  errorSummary: "Please check the highlighted fields.",

  resultTitle: "Your result",
  resultLabel: "Average effective cost",
  perKwh: "per kWh",
  average: (avg) => `Texas residential average: ${fmtCents(avg.cents, "en")} per kWh (${avg.periodEn}).`,
  levels: {
    alta: (r) => ({
      title: `You pay about ${r.diffPct}% more than the Texas average`,
      text: "It's worth reviewing your plan. A comparison with plans available for your ZIP code will tell you whether there is a better option for you.",
    }),
    media: () => ({
      title: "You're close to the Texas average",
      text: "Your cost is within the typical range. Still, if your contract ends soon, compare before you renew.",
    }),
    baja: (r) => ({
      title: `You pay about ${Math.abs(r.diffPct)}% less than the Texas average`,
      text: "Your current cost is low compared with the average. If your contract ends soon, compare before renewing so you don't lose that price.",
    }),
  },
  disclaimer:
    "This number is your bill divided by your kWh: it includes fixed charges, delivery charges from your utility and taxes. That's why it isn't the same as your contract rate and it can change month to month. It's a reference, not a guarantee of savings.",
  zones: {
    fuera_de_texas: "For now we only review electricity in Texas.",
    sin_opcion_probable:
      "In your ZIP code, service is likely provided by a city-owned utility or a co-op, so you may not be able to choose a provider. We can confirm it in the review.",
    texas: "",
  },
  contract: {
    vencido: (c) =>
      `Your contract ended on ${fmtDate(c.date, "en")}. If you didn't choose a new plan, you may be on a month-to-month or variable plan. Check your bill.`,
    ventana: (c) =>
      `Your contract ends in ${c.days} ${c.days === 1 ? "day" : "days"}. Under PUCT rules, starting 14 days before it ends you can switch without an early termination fee.`,
    pronto: (c) =>
      `Your contract ends on ${fmtDate(c.date, "en")} (in ${c.days} days). A good time to compare. Under PUCT rules, you can switch without an early termination fee starting 14 days before it ends.`,
    despues: (c) =>
      `Your contract ends on ${fmtDate(c.date, "en")}. Switching earlier may carry an early termination fee: check your contract (EFL and terms of service).`,
  },
  ctaTitle: "Want to know if there's a better plan for you?",
  ctaText:
    "We'll prepare a personalized comparison with plans available for your ZIP code. We'll use the numbers you already entered and only ask how to contact you.",
  cta: "Request a personalized comparison",
  ctaNote: "No commitment. We will never ask for your Social Security number or ID by chat or WhatsApp.",
  recalc: "Try another bill",
  sources: "Sources",
  sourceEia: "Average: U.S. Energy Information Administration (EIA-861M)",
  sourcePuct: "Contract expiration: Public Utility Commission of Texas (PUCT)",
  share: {
    button: "Share the calculator",
    whatsapp: "Send on WhatsApp",
    copied: "Link copied!",
    title: "Electricity cost calculator",
    text: "Do you know how much you really pay per kWh of electricity? Find out in a minute, without giving your name or phone number:",
  },
  reminder: {
    title: "Want a reminder before your contract ends?",
    text: "We'll message you on WhatsApp a few weeks before it ends, right when you can compare and switch without an early termination fee. One reminder, no commitment.",
    open: "Yes, remind me",
    date: "Contract expiration date",
    name: "Your name",
    phone: "Your WhatsApp number",
    email: "Email",
    optional: "optional",
    consent:
      "I agree that Vínculos 360 may send me a reminder on WhatsApp (and by email, if I entered one) before my electricity contract ends, and contact me about that reminder at the number I provided. Message and data rates may apply. Agreeing is not a condition of purchasing any service, and I can ask not to be contacted at any time.",
    submit: "Save my reminder",
    sending: "Saving…",
    success: (name, date) => `All set, ${name}! We'll remind you before ${date}.`,
    successNote: "If you'd like to review your options sooner, message us on WhatsApp anytime.",
    rejected: "We couldn't save your reminder. Please try again in a moment.",
    offline: "You seem to be offline. Please try again when you're back online.",
    unverified: "We couldn't confirm it was saved. To be sure, message us on WhatsApp.",
    errors: {
      date_required: "Enter the expiration date.",
      date_invalid: "Please check the expiration date.",
      date_past: "That date has passed. If your contract already ended, request the personalized comparison instead.",
      name_required: "Enter your name.",
      name_invalid: "Enter your name (letters only).",
      phone_required: "Enter your WhatsApp number.",
      phone_invalid: "Enter a 10-digit U.S. number.",
      email_invalid: "Please check the email.",
      consent_required: "Check the box to save your reminder.",
    },
  },
  tipsTitle: "Where do I find these numbers?",
  tips: [
    "The electric service total is in the summary of charges for the period.",
    "The kWh are next to the meter reading or under “usage”.",
    "The expiration date is on your bill or in the notice your provider must send at least 30 days before.",
  ],
};

export const ANALYZER_STRINGS = { es, en };
export { fmtCents, fmtDate };

export const SOURCE_URLS = {
  eia: "https://www.eia.gov/electricity/data/eia861m/",
  puct: "https://www.puc.texas.gov/consumer/facts/faq/electricity",
};
