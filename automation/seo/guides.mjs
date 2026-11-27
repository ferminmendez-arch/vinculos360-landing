/* =========================================================
   GUÍAS SEO (contenido original, en español)

   Cada guía responde una búsqueda real con intención comercial
   (ver docs/GOOGLE-ORGANICO.md) y lleva al Analizador de factura o
   al chat. Reglas: sin precios, sin promesas de ahorro, sin nombres
   de proveedores, sin "gratis", sin mencionar crédito. Cada dato
   regulatorio cita una fuente oficial (PUCT / Código Administrativo
   de Texas). Se revisan con claims-lint en las pruebas.

   Para publicar cambios: node automation/seo/build-guides.mjs
   (genera public/guias/** y actualiza public/sitemap.xml).
========================================================= */

export const UPDATED = "2026-11-27";
export const UPDATED_LABEL = "noviembre de 2026";

const PUCT_FAQ = { label: "PUCT — Preguntas frecuentes sobre electricidad", url: "https://puc.texas.gov/consumer/facts/faq/electricity" };
const RULE_25_475 = {
  label: "Código Administrativo de Texas, 16 TAC §25.475 (requisitos y divulgaciones de los proveedores)",
  url: "https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-25-475",
};
const PUCT_EFL = { label: "PUCT — Etiquetas de Datos de Electricidad (EFL)", url: "https://www.puc.texas.gov/industry/electric/rates/facts/Default.aspx" };

/* cta: "analizador" | "recordatorio" | "chat" */
export const GUIDES = [
  {
    slug: "costo-por-kwh",
    title: "Cómo calcular cuánto pagas por kWh con tu factura de luz en Texas",
    h1: "¿Cuánto pagas de verdad por kWh? Calcúlalo con tu factura",
    description:
      "Aprende a calcular tu costo efectivo por kWh con dos datos de tu factura de energía eléctrica en Texas y a compararlo con la EFL de cualquier plan.",
    keywords: ["costo por kWh", "precio por kWh Texas", "factura de luz", "cheap light company"],
    cta: "analizador",
    sections: [
      {
        h2: "El precio anunciado no siempre es lo que pagas",
        p: [
          "Muchos planes de energía eléctrica en Texas anuncian un precio por kWh, pero tu factura incluye más cosas: un cargo base mensual, los cargos de entrega de la compañía distribuidora y, en algunos planes, créditos que solo se aplican si consumes cierta cantidad.",
          "Por eso la forma más clara de saber cuánto pagas es calcular tu <strong>costo efectivo por kWh</strong>: lo que pagaste en total dividido entre lo que consumiste.",
        ],
      },
      {
        h2: "Cómo calcularlo en 3 pasos",
        ol: [
          "Busca en tu factura el <strong>total del periodo</strong> (lo que pagaste por ese mes de servicio).",
          "Busca el <strong>consumo en kWh</strong> de ese mismo periodo. Suele aparecer como “uso”, “consumo” o “kWh usados”.",
          "Divide el total entre los kWh. El resultado es tu costo por kWh en dólares; multiplícalo por 100 para verlo en centavos.",
        ],
        p: [
          "Hazlo con dos o tres facturas: en los meses de más calor o frío el consumo cambia, y con él el costo efectivo.",
        ],
      },
      {
        h2: "Compáralo con la EFL, no con el anuncio",
        p: [
          "Todo plan residencial en Texas debe tener una <strong>Etiqueta de Datos de Electricidad (EFL)</strong>. La EFL muestra el precio promedio por kWh si consumes 500, 1,000 o 2,000 kWh al mes.",
          "Compara tu costo efectivo con el precio de la EFL que más se parezca a tu consumo real. Si tu consumo es muy distinto a esos tres niveles, pide que te expliquen cómo cambia el precio con tu uso.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Dónde encuentro los kWh que usé?",
        a: "En la sección de uso o consumo de tu factura. Algunas facturas muestran además una gráfica de los últimos meses.",
      },
      {
        q: "¿La EFL es lo mismo que el contrato?",
        a: "Es uno de los tres documentos del contrato, junto con los Términos del Servicio (TOS) y “Tus derechos como cliente” (YRAC).",
      },
    ],
    sources: [PUCT_EFL, RULE_25_475],
  },
  {
    slug: "factura-de-luz-alta",
    title: "¿Por qué subió tu factura de luz en Texas? 5 causas comunes",
    h1: "¿Por qué subió tu factura de energía eléctrica? 5 causas comunes",
    description:
      "Si tu factura de luz en Texas subió de repente, revisa estas cinco causas: consumo, fin de contrato, créditos por consumo, cargos fijos y días facturados.",
    keywords: ["factura de luz alta", "why is my electric bill so high", "subió mi recibo de luz"],
    cta: "analizador",
    sections: [
      {
        h2: "1. Usaste más kWh",
        p: [
          "Es la causa más común. El aire acondicionado en verano o la calefacción eléctrica en invierno pueden subir mucho el consumo. Compara los kWh de esta factura con los del mes anterior y con el mismo mes del año pasado.",
        ],
      },
      {
        h2: "2. Tu contrato terminó",
        p: [
          "Cuando un contrato a plazo fijo termina y no eliges un plan nuevo, es común que el servicio siga con un plan mes a mes, cuyo precio puede cambiar. Revisa la fecha de vencimiento en tus documentos o en el aviso que te envió tu proveedor.",
        ],
      },
      {
        h2: "3. No alcanzaste un crédito por consumo",
        p: [
          "Algunos planes dan un crédito solo si consumes dentro de cierto rango. Si ese mes quedaste fuera del rango, el costo por kWh puede subir aunque tu consumo no haya cambiado mucho. La EFL de tu plan explica si tiene este tipo de crédito.",
        ],
      },
      {
        h2: "4. Los cargos fijos pesan más cuando consumes poco",
        p: [
          "El cargo base y los cargos mensuales de la compañía distribuidora se cobran igual consumas mucho o poco. En meses de bajo consumo se reparten entre menos kWh y tu costo efectivo sube.",
        ],
      },
      {
        h2: "5. El periodo de facturación fue más largo",
        p: ["Una factura que cubre más días que la anterior normalmente trae más kWh. Revisa las fechas del periodo."],
      },
      {
        h2: "Qué hacer ahora",
        p: [
          "Calcula tu costo efectivo por kWh con el analizador y revisa la fecha de vencimiento de tu contrato. Si quieres, te explicamos tu factura en español, sin compromiso.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Cómo sé si mi contrato ya venció?",
        a: "Tu proveedor debe avisarte antes de que venza. También puedes revisar tus Términos del Servicio o llamar a tu proveedor.",
      },
    ],
    sources: [PUCT_FAQ, RULE_25_475],
  },
  {
    slug: "vence-tu-contrato-de-luz",
    title: "Vence tu contrato de luz en Texas: qué hacer y cuándo cambiar",
    h1: "¿Se vence tu contrato de energía eléctrica? Qué hacer y cuándo",
    description:
      "Tu proveedor debe avisarte al menos 30 días antes del vencimiento, y en los últimos 14 días puedes cambiar sin cargo por cancelación. Cómo aprovecharlo.",
    keywords: ["renovar contrato de luz", "contrato de luz vencido", "cambiar compañía de luz sin penalidad"],
    cta: "recordatorio",
    sections: [
      {
        h2: "Lo que dice la regla en Texas",
        ul: [
          "Los proveedores deben avisar a los clientes residenciales <strong>al menos 30 días antes</strong> de que venza el contrato.",
          "Puedes cambiar de plan o de proveedor <strong>sin cargo por cancelación anticipada</strong> si el cambio ocurre dentro de los <strong>14 días</strong> previos a la fecha de vencimiento indicada en el aviso.",
          "Un contrato mes a mes (31 días o menos) no puede tener cargo por cancelación.",
        ],
      },
      {
        h2: "Un plan sencillo para no perder la fecha",
        ol: [
          "Anota la fecha de vencimiento en cuanto llegue el aviso.",
          "Unas semanas antes, calcula tu costo efectivo por kWh con tus últimas facturas.",
          "Compara opciones usando la EFL de cada plan, al nivel de consumo más parecido al tuyo.",
          "Programa el cambio para que ocurra dentro de los últimos 14 días del contrato.",
        ],
      },
      {
        h2: "Si no haces nada",
        p: [
          "Es común que el servicio continúe con un plan mes a mes, cuyo precio puede cambiar de un mes a otro. No te quedas sin servicio, pero conviene revisar el precio.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Puedo cambiar antes de los últimos 14 días?",
        a: "Sí, pero tu contrato podría cobrarte un cargo por cancelación anticipada. El monto está en tu EFL y en tus Términos del Servicio.",
      },
    ],
    sources: [PUCT_FAQ, RULE_25_475],
  },
  {
    slug: "mudanza-luz-texas",
    title: "Te mudas en Texas: cómo manejar tu servicio de luz sin penalidades",
    h1: "¿Te mudas? Cómo manejar tu servicio de energía eléctrica en Texas",
    description:
      "Si te mudas en Texas, tu proveedor no puede cobrarte cargo por cancelación por la mudanza si das tu nueva dirección. Pasos para la casa nueva, en español.",
    keywords: ["luz para casa nueva", "mudanza electricidad Texas", "set up electricity", "conectar la luz"],
    cta: "chat",
    sections: [
      {
        h2: "Tu contrato actual",
        p: [
          "En Texas, el proveedor <strong>no puede cobrarte cargo por cancelación anticipada por mudarte</strong> si le das tu dirección nueva y, si te la pide, una prueba razonable de que ya no vives en la dirección anterior.",
          "Avísale con tiempo la fecha en que dejas la casa para que el servicio termine ese día y no sigas pagando consumo de otra persona.",
        ],
      },
      {
        h2: "Tu casa nueva",
        ol: [
          "Confirma si tu nueva dirección está en una zona donde puedes elegir proveedor. En Houston y muchas otras zonas sí; en ciudades como Austin o San Antonio el servicio lo da la empresa municipal.",
          "Ten a la mano la dirección completa y la fecha de mudanza. Cada medidor tiene un número de identificación (ESI ID) que ayuda a evitar errores de dirección.",
          "Antes de inscribirte, pide y lee la EFL, los Términos del Servicio y “Tus derechos como cliente”.",
          "Pide el servicio con algunos días de anticipación para llegar con la luz conectada.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Puedo llevarme mi plan a la casa nueva?",
        a: "Depende del proveedor y de la zona. Pregúntale a tu proveedor antes de cancelar.",
      },
    ],
    sources: [RULE_25_475, PUCT_FAQ],
  },
];

/* Texto publicable de una guía, para el verificador de afirmaciones. */
export function guideText(guide) {
  const parts = [guide.title, guide.h1, guide.description];
  for (const s of guide.sections) parts.push(s.h2, ...(s.p || []), ...(s.ol || []), ...(s.ul || []));
  for (const f of guide.faq || []) parts.push(f.q, f.a);
  return parts.join("\n").replace(/<[^>]+>/g, "");
}
