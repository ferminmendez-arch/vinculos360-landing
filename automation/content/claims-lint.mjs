/* =========================================================
   VERIFICADOR DE AFIRMACIONES (guardrail del Agente de Contenido)

   Revisa cada borrador antes de que llegue al dueño y otra vez antes
   de publicar. Bloquea afirmaciones comerciales que no estén
   verificadas en automation/config/business.json:
   - promesas de ahorro con cifras, porcentajes o precios
   - "gratis" / "sin costo" (solo si el dueño lo confirmó)
   - garantías y superlativos ("el más barato", "garantizado")
   - nombres de proveedores no confirmados (incluido el proveedor
     de seguridad, que no se muestra públicamente)
   - certificaciones o licencias no confirmadas
   - testimonios o reseñas inventadas

   Uso: node automation/content/claims-lint.mjs [archivos o carpetas]
========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSection, loadBusiness, parseFrontMatter, REPO_DIR } from "../lib/common.mjs";

/* Nombres comerciales que no deben aparecer sin verificación. */
const PROVIDER_NAMES = [
  "TXU", "Reliant", "Gexa", "Rhythm", "Chariot", "Constellation", "Direct Energy", "Green Mountain",
  "Just Energy", "Frontier Utilities", "4Change", "Cirro", "Pulse Power", "Discount Power", "Payless Power",
  "Express Energy", "Champion Energy", "Ambit", "Octopus", "Tara Energy", "Shell Energy", "Energy Texas",
  "Amigo Energy", "Trieagle", "Veteran Energy", "Base Power", "XOOM", "Xoom Energy", "ACN", "acnibo",
  "IDSeal", "DIRECTV", "Flash Mobile", "Impact Health Sharing", "Vivint", "ADT", "Ring", "SimpliSafe",
  "AT&T", "Xfinity", "Spectrum", "Frontier", "T-Mobile", "Verizon",
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RULES = [
  {
    id: "savings-amount",
    message: "Promesa de ahorro con cifra, porcentaje o monto.",
    pattern: /(ahorr\w*|save[sd]?|saving[s]?)[^.\n]{0,40}(\$\s?\d|\d+\s?%|\d+\s?(d[oó]lares|dollars))/i,
  },
  {
    id: "percent-or-money-claim",
    message: "Cifra de dinero o porcentaje: requiere fuente verificada y aprobación.",
    pattern: /(\$\s?\d[\d,.]*|\d+(\.\d+)?\s?%|\d+(\.\d+)?\s?(¢|centavos|cents))/i,
  },
  {
    id: "guarantee",
    message: "Garantía o superlativo no comprobable.",
    pattern: /\b(garantizad[oa]s?|garantizamos|guarantee[sd]?|el m[aá]s barato|la m[aá]s barata|los m[aá]s baratos|cheapest|lowest (price|rate)|mejor precio|best (price|rate)|100\s?% seguro)\b/i,
  },
  {
    id: "free",
    message: "\"Gratis\" / \"sin costo\" para el cliente: requiere confirmación del dueño (serviceIsFreeForCustomer).",
    pattern: /\b(gratis|gratuit[oa]|sin costo para (ti|usted)|free (for you|service|consultation|quote)|at no cost to you)\b/i,
    unlessFact: "serviceIsFreeForCustomer",
  },
  {
    id: "credential",
    message: "Afirmación de licencia o certificación: requiere confirmación del dueño.",
    pattern: /(somos|estamos)\s+(\p{L}+\s+)?(certificad|licenciad|registrad|autorizad)\p{L}*|registrad\p{L}*\s+(ante|con)\s+la\s+PUCT|\bwe('re| are)\s+(\w+\s+)?(certified|licensed|registered|authorized)\b|registered with the PUCT/iu,
    unlessFact: "puctBrokerRegistration",
  },
  {
    id: "testimonial",
    message: "Testimonio o reseña: solo se publican testimonios reales con permiso.",
    pattern: /(testimoni|rese[nñ]a de cliente|customer review|\b5 estrellas\b|★★★★★)/i,
  },
];

export function lintText(text, { business = loadBusiness(), fileLabel = "texto" } = {}) {
  const facts = business.commercialFacts || {};
  const verifiedProviders = facts.electricityProviders?.verified ? facts.electricityProviders.value || [] : [];
  const findings = [];

  for (const rule of RULES) {
    if (rule.unlessFact && facts[rule.unlessFact]?.verified && facts[rule.unlessFact]?.value) continue;
    const m = rule.pattern.exec(text);
    if (m) findings.push({ file: fileLabel, rule: rule.id, message: rule.message, match: m[0] });
  }

  for (const name of PROVIDER_NAMES) {
    if (verifiedProviders.some((p) => p.toLowerCase() === name.toLowerCase())) continue;
    const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}([^\\p{L}]|$)`, "iu");
    const strict = name.length <= 4 ? new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}([^\\p{L}]|$)`, "u") : re;
    const m = strict.exec(text);
    if (m) findings.push({ file: fileLabel, rule: "provider-name", message: `Nombre de empresa no verificado: ${name}.`, match: name });
  }

  return findings;
}

/* Revisa un archivo de publicación (front matter + cuerpo). */
export function lintPostFile(file, { business = loadBusiness() } = {}) {
  const raw = fs.readFileSync(file, "utf8");
  const { data, body } = parseFrontMatter(raw);
  const label = path.relative(REPO_DIR, file);
  // Se revisa solo el texto publicable (las notas internas pueden mencionar las reglas).
  const publishable = [extractSection(body, "Publicar"), extractSection(body, "English (opcional)")].filter(Boolean).join("\n\n") || body;
  const findings = lintText(publishable, { business, fileLabel: label });

  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    findings.push({ file: label, rule: "missing-source", message: "La publicación no cita ninguna fuente.", match: "" });
  }
  if (!/utm_source=/.test(publishable)) {
    findings.push({ file: label, rule: "missing-utm", message: "El enlace no tiene UTM; no se podrá medir.", match: "" });
  }
  const facts = business.commercialFacts || {};
  for (const req of data.requires || []) {
    if (!facts[req]?.verified) {
      findings.push({ file: label, rule: "unverified-requirement", message: `Depende de un dato no confirmado: ${req}.`, match: req });
    }
  }
  return findings;
}

export function collectPostFiles(targets) {
  const out = [];
  const visit = (p) => {
    if (!fs.existsSync(p)) return;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p)) visit(path.join(p, entry));
    } else if (/\.md$/.test(p) && !/CALENDARIO\.md$|README\.md$/i.test(p)) {
      out.push(p);
    }
  };
  targets.forEach((t) => visit(path.resolve(t)));
  return out.sort();
}

/* ---------- CLI ---------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2);
  const files = collectPostFiles(targets.length ? targets : [path.join(REPO_DIR, "marketing", "posts")]);
  const business = loadBusiness();
  const findings = files.flatMap((f) => lintPostFile(f, { business }));
  for (const f of findings) {
    console.log(`✗ ${f.file} [${f.rule}] ${f.message}${f.match ? ` → "${f.match}"` : ""}`);
  }
  console.log(`${files.length} archivo(s) revisado(s), ${findings.length} problema(s).`);
  if (findings.length) process.exitCode = 1;
}
