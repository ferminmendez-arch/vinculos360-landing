/* Guías SEO: contenido verificable, sin afirmaciones bloqueadas y archivos al día. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GUIDES, guideText } from "../automation/seo/guides.mjs";
import { renderGuide, renderIndex, updateSitemap } from "../automation/seo/build-guides.mjs";
import { lintText } from "../automation/content/claims-lint.mjs";
import { buildLink, loadTopics } from "../automation/content/generate.mjs";
import { loadBusiness } from "../automation/lib/common.mjs";

const PUBLIC = path.resolve("public");

test("ninguna guía tiene afirmaciones bloqueadas (precios, ahorro, gratis, marcas, crédito)", () => {
  for (const g of GUIDES) {
    assert.deepEqual(lintText(guideText(g), { fileLabel: g.slug }), [], g.slug);
    assert.doesNotMatch(guideText(g), /cr[eé]dito (malo|bueno)|mal cr[eé]dito|historial de cr[eé]dito|credit score/i, `${g.slug}: no se menciona crédito`);
  }
});

test("cada guía cita fuentes oficiales y lleva a un mecanismo de captura", () => {
  for (const g of GUIDES) {
    assert.ok(g.sources.length > 0, g.slug);
    for (const s of g.sources) assert.match(s.url, /^https:\/\/(www\.)?(puc\.texas\.gov|law\.cornell\.edu|ftp\.puc\.texas\.gov)\//, s.url);
    assert.ok(["analizador", "recordatorio", "chat"].includes(g.cta), g.slug);
    assert.ok(g.description.length <= 170, `${g.slug}: descripción de ${g.description.length} caracteres`);
  }
});

test("slugs únicos y HTML con una sola h1, canonical y GA sin datos personales", () => {
  const slugs = new Set(GUIDES.map((g) => g.slug));
  assert.equal(slugs.size, GUIDES.length);
  for (const g of GUIDES) {
    const html = renderGuide(g);
    assert.equal((html.match(/<h1>/g) || []).length, 1, g.slug);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://www.vinculos360.com/guias/${g.slug}/" />`));
    assert.match(html, /data-ga="G-D5YCCQLYG1"/);
    assert.doesNotMatch(html, /<script>(?!\s*$)/, "sin scripts en línea (CSP)");
  }
});

test("public/guias está al día con el generador", () => {
  assert.equal(fs.readFileSync(path.join(PUBLIC, "guias", "index.html"), "utf8"), renderIndex());
  for (const g of GUIDES) {
    assert.equal(fs.readFileSync(path.join(PUBLIC, "guias", g.slug, "index.html"), "utf8"), renderGuide(g), `${g.slug}: corre node automation/seo/build-guides.mjs`);
  }
});

test("el sitemap incluye cada guía una sola vez (actualizar es idempotente)", () => {
  const xml = fs.readFileSync(path.join(PUBLIC, "sitemap.xml"), "utf8");
  assert.equal(updateSitemap(xml), xml);
  for (const g of GUIDES) assert.equal(xml.split(`/guias/${g.slug}/</loc>`).length - 1, 1, g.slug);
  assert.match(xml, /<loc>https:\/\/www.vinculos360.com\/<\/loc>/, "la portada sigue en el sitemap");
});

test("Agente de Contenido: los temas con guía enlazan a la guía (ES) con UTM", () => {
  const business = loadBusiness();
  const topics = loadTopics();
  const withGuide = topics.filter((t) => t.guide);
  assert.ok(withGuide.length >= 3);
  for (const t of withGuide) {
    assert.ok(GUIDES.some((g) => g.slug === t.guide), `${t.id} → ${t.guide}`);
    const url = new URL(buildLink(business, t.id, "es", t.guide));
    assert.equal(url.pathname, `/guias/${t.guide}/`);
    assert.equal(url.searchParams.get("utm_content"), t.id);
  }
});
