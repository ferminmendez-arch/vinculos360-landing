/* =========================================================
   GENERADOR DE GUÍAS SEO → public/guias/**

   HTML estático (sin React): carga rápido, Google lo lee completo
   y no depende de JavaScript. Genera también public/guias/index.html
   y agrega las guías a public/sitemap.xml.

   Uso: node automation/seo/build-guides.mjs
========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDES, UPDATED, UPDATED_LABEL } from "./guides.mjs";

const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC = path.join(REPO_DIR, "public");
const SITE = "https://www.vinculos360.com";
const GA_ID = "G-D5YCCQLYG1";
const WHATSAPP = "12818257327";
const PHONE_DISPLAY = "(281) 825-7327";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/* Los textos de guides.mjs pueden traer <strong>; nada más. */
const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");

const CTA = {
  analizador: {
    title: "Calcula tu costo por kWh en 1 minuto",
    text: "Escribe el total y los kWh de tu última factura. Te mostramos tu costo efectivo y cómo se compara con el promedio residencial de Texas. No pedimos nombre ni teléfono para ver el resultado.",
    label: "Usar el Analizador de factura",
    href: "/#analizador",
  },
  recordatorio: {
    title: "Que no se te pase la fecha",
    text: "En el Analizador de factura puedes calcular tu costo por kWh y pedir un recordatorio antes de que venza tu contrato.",
    label: "Calcular y crear mi recordatorio",
    href: "/#analizador",
  },
  chat: {
    title: "¿Te mudas pronto? Te orientamos en español",
    text: "Cuéntanos tu ZIP y la fecha de mudanza, y te explicamos las opciones de energía eléctrica para tu casa nueva.",
    label: "Hablar con un asesor",
    href: "/?chat=1",
  },
};

export function sourceUrl(slug) {
  return `${SITE}/guias/${slug}/`;
}

function layout({ title, description, canonical, body, jsonLd }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#0b24a8" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="es_US" />
    <meta property="og:site_name" content="Vínculos 360" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/og-image.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="/guias/guias.css" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script src="/guias/guias.js" data-ga="${GA_ID}" defer></script>
  </head>
  <body>
    <header class="top">
      <div class="wrap top-in">
        <a class="logo" href="/"><img src="/logo-vinculos360.png" alt="Vínculos 360" width="150" height="40" /></a>
        <a class="wa" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, leí una guía en vinculos360.com y tengo una pregunta sobre mi energía eléctrica.")}" target="_blank" rel="noopener noreferrer">WhatsApp ${PHONE_DISPLAY}</a>
      </div>
    </header>
    <main class="wrap">
${body}
    </main>
    <footer class="foot">
      <div class="wrap">
        <p><strong>Vínculos 360</strong> · Conectamos lo que te importa. Somos representantes independientes de servicios esenciales para el hogar; no somos una compañía de electricidad.</p>
        <p>Esta guía es informativa y no reemplaza los documentos de tu plan (EFL, Términos del Servicio y “Tus derechos como cliente”).</p>
        <p><a href="/guias/">Todas las guías</a> · <a href="/">Inicio</a> · <a href="/privacidad/">Privacidad</a></p>
      </div>
    </footer>
  </body>
</html>
`;
}

function renderSection(s) {
  let html = `      <h2>${esc(s.h2)}</h2>\n`;
  for (const p of s.p && !s.ol && !s.ul ? s.p : []) html += `      <p>${rich(p)}</p>\n`;
  if (s.ol) html += `      <ol>\n${s.ol.map((li) => `        <li>${rich(li)}</li>`).join("\n")}\n      </ol>\n`;
  if (s.ul) html += `      <ul>\n${s.ul.map((li) => `        <li>${rich(li)}</li>`).join("\n")}\n      </ul>\n`;
  if (s.p && (s.ol || s.ul)) for (const p of s.p) html += `      <p>${rich(p)}</p>\n`;
  return html;
}

export function renderGuide(g) {
  const canonical = sourceUrl(g.slug);
  const cta = CTA[g.cta];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.h1,
        description: g.description,
        inLanguage: "es-US",
        dateModified: UPDATED,
        mainEntityOfPage: canonical,
        author: { "@type": "Organization", name: "Vínculos 360", url: `${SITE}/` },
        publisher: { "@type": "Organization", name: "Vínculos 360", logo: { "@type": "ImageObject", url: `${SITE}/logo-vinculos360.png` } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE}/guias/` },
          { "@type": "ListItem", position: 3, name: g.h1, item: canonical },
        ],
      },
      ...(g.faq?.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ]
        : []),
    ],
  };
  const body = `      <nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a> › <a href="/guias/">Guías</a></nav>
      <article>
      <h1>${esc(g.h1)}</h1>
      <p class="meta">Actualizado: ${UPDATED_LABEL} · Lectura de 3 minutos</p>
      <p class="lead">${esc(g.description)}</p>
${g.sections.map(renderSection).join("")}
      <aside class="cta" data-guide="${g.slug}">
        <h2>${esc(cta.title)}</h2>
        <p>${esc(cta.text)}</p>
        <a class="btn" href="${cta.href}">${esc(cta.label)}</a>
      </aside>
${
  g.faq?.length
    ? `      <h2>Preguntas frecuentes</h2>\n${g.faq.map((f) => `      <h3>${esc(f.q)}</h3>\n      <p>${esc(f.a)}</p>`).join("\n")}\n`
    : ""
}      <h2>Fuentes</h2>
      <ul class="sources">
${g.sources.map((s) => `        <li><a href="${s.url}" rel="noopener" target="_blank">${esc(s.label)}</a></li>`).join("\n")}
      </ul>
      <p class="more">Más guías: ${GUIDES.filter((x) => x.slug !== g.slug)
        .map((x) => `<a href="/guias/${x.slug}/">${esc(x.h1)}</a>`)
        .join(" · ")}</p>
      </article>`;
  return layout({ title: `${g.title} | Vínculos 360`, description: g.description, canonical, body, jsonLd });
}

export function renderIndex() {
  const canonical = `${SITE}/guias/`;
  const description = "Guías en español para entender tu factura de energía eléctrica en Texas: costo por kWh, factura alta, fin de contrato y mudanzas.";
  const body = `      <nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a> › Guías</nav>
      <h1>Guías de energía eléctrica en español para Texas</h1>
      <p class="lead">${esc(description)} Escritas para que tomes decisiones con calma y con tus propios números.</p>
      <ul class="cards">
${GUIDES.map((g) => `        <li><a href="/guias/${g.slug}/"><strong>${esc(g.h1)}</strong><span>${esc(g.description)}</span></a></li>`).join("\n")}
      </ul>
      <aside class="cta"><h2>${esc(CTA.analizador.title)}</h2><p>${esc(CTA.analizador.text)}</p><a class="btn" href="/#analizador">${esc(CTA.analizador.label)}</a></aside>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Guías de energía eléctrica en español para Texas",
    inLanguage: "es-US",
    url: canonical,
    hasPart: GUIDES.map((g) => ({ "@type": "Article", headline: g.h1, url: sourceUrl(g.slug) })),
  };
  return layout({ title: "Guías de energía eléctrica (luz) en español para Texas | Vínculos 360", description, canonical, body, jsonLd });
}

export function updateSitemap(xml) {
  const urls = [`${SITE}/guias/`, ...GUIDES.map((g) => sourceUrl(g.slug)), `${SITE}/privacidad/`];
  let out = xml.replace(/\s*<url>\s*<loc>https:\/\/www\.vinculos360\.com\/(guias|privacidad)\/[^<]*<\/loc>[\s\S]*?<\/url>/g, "");
  const entries = urls.map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${UPDATED}</lastmod>\n  </url>`).join("\n");
  return out.replace("</urlset>", `${entries}\n</urlset>`);
}

/* ---------- CLI ---------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.join(PUBLIC, "guias");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderIndex());
  for (const g of GUIDES) {
    fs.mkdirSync(path.join(dir, g.slug), { recursive: true });
    fs.writeFileSync(path.join(dir, g.slug, "index.html"), renderGuide(g));
  }
  const sitemapPath = path.join(PUBLIC, "sitemap.xml");
  fs.writeFileSync(sitemapPath, updateSitemap(fs.readFileSync(sitemapPath, "utf8")));
  console.log(`${GUIDES.length} guía(s) + índice generados en public/guias/; sitemap actualizado.`);
}
