/* =========================================================
   AGENTE 1 — CONTENIDO Y CRECIMIENTO ORGÁNICO

   Genera el calendario de la semana siguiente con publicaciones
   para Facebook (español primero, versión en inglés opcional) a
   partir del banco de temas verificados (topics.json).

   - No repite temas hasta haber usado todo el banco.
   - Cada publicación lleva un enlace con UTM único (utm_content =
     id del tema) para medir qué publicación trae leads.
   - Todo se crea con status "draft": nada se publica hasta que el
     dueño lo cambie a "approved" y apruebe el Pull Request.
   - Se omiten temas que dependen de datos comerciales no confirmados.

   Uso: node automation/content/generate.mjs [--week-start AAAA-MM-DD] [--dry-run]
========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTOMATION_DIR, REPO_DIR, WEEKDAYS_ES, addDays, createLogger, isoWeek, loadBusiness,
  nextMonday, parseFrontMatter, readJson, stringifyFrontMatter, zonedToUtc,
} from "../lib/common.mjs";
import { lintText } from "./claims-lint.mjs";

export function loadTopics() {
  return readJson(path.join(AUTOMATION_DIR, "content", "topics.json")).topics;
}

/* Ids de temas ya usados en publicaciones existentes, del más antiguo al más reciente. */
export function usedTopicIds(postsDir) {
  const used = [];
  if (!fs.existsSync(postsDir)) return used;
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".md") && entry.name !== "CALENDARIO.md") files.push(p);
    }
  };
  walk(postsDir);
  for (const f of files.sort()) {
    const { data } = parseFrontMatter(fs.readFileSync(f, "utf8"));
    if (data.topic) used.push(data.topic);
  }
  return used;
}

/* Elige `count` temas: primero los nunca usados, luego los usados hace más tiempo. */
export function pickTopics(topics, used, count, business) {
  const facts = business.commercialFacts || {};
  const eligible = topics.filter((t) => (t.requires || []).every((r) => facts[r]?.verified && facts[r]?.value));
  const lastUse = new Map();
  used.forEach((id, i) => lastUse.set(id, i));
  const sorted = [...eligible].sort((a, b) => {
    const ua = lastUse.has(a.id) ? lastUse.get(a.id) : -1;
    const ub = lastUse.has(b.id) ? lastUse.get(b.id) : -1;
    return ua - ub || eligible.indexOf(a) - eligible.indexOf(b);
  });
  // Evita dos temas del mismo pilar seguidos cuando es posible.
  const picked = [];
  const pool = [...sorted];
  while (picked.length < count && pool.length) {
    const prevPillar = picked.at(-1)?.pillar;
    const idx = pool.findIndex((t) => t.pillar !== prevPillar);
    picked.push(pool.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return picked;
}

export function buildLink(business, topicId, lang = "es") {
  const base = lang === "en" ? `${business.siteUrl}/en/` : `${business.siteUrl}/`;
  const params = new URLSearchParams({
    service: "electricidad",
    utm_source: business.utm.source,
    utm_medium: business.utm.medium,
    utm_campaign: business.utm.campaign,
    utm_content: topicId,
  });
  return `${base}?${params.toString()}`;
}

export function renderPost(topic, slot, business) {
  const linkEs = buildLink(business, topic.id, "es");
  const linkEn = buildLink(business, topic.id, "en");
  const scheduledAt = zonedToUtc(slot.date, slot.time, business.timezone);
  const front = {
    status: "draft",
    channel: "facebook",
    topic: topic.id,
    pillar: topic.pillar,
    title: topic.title_es,
    date: slot.date,
    time: slot.time,
    timezone: business.timezone,
    scheduled_utc: scheduledAt.toISOString(),
    link: linkEs,
    sources: topic.sources,
  };
  if (topic.requires?.length) front.requires = topic.requires;
  const body = [
    `# ${topic.title_es}`,
    "",
    "> Borrador generado por el Agente de Contenido. Para publicarlo, revisa el texto y cambia `status` a `approved`.",
    "> Solo se publica la sección **Publicar**. No agregues cifras de ahorro, precios, nombres de proveedores ni \"gratis\" sin confirmación.",
    "",
    "## Publicar",
    "",
    topic.es.replaceAll("{{link}}", linkEs),
    "",
    "## English (opcional)",
    "",
    topic.en.replaceAll("{{link}}", linkEn),
    "",
    "## Fuentes",
    "",
    ...topic.sources.map((s) => `- ${s}`),
    "",
  ].join("\n");
  return stringifyFrontMatter(front) + "\n" + body;
}

export function generateWeek({ weekStart, business = loadBusiness(), topics = loadTopics(), postsDir, write = true, logger } = {}) {
  const log = logger || createLogger("contenido");
  const dir = postsDir || path.join(REPO_DIR, "marketing", "posts");
  const start = weekStart || nextMonday(new Date(), business.timezone);
  const week = isoWeek(start);
  const weekDir = path.join(dir, week);

  if (fs.existsSync(weekDir) && fs.readdirSync(weekDir).some((f) => f.endsWith(".md"))) {
    log.info("La semana ya tiene borradores; no se sobrescriben.", { week });
    return { week, created: [], skipped: true };
  }

  const slots = business.contentSchedule.slots.map((s) => ({ date: addDays(start, s.weekday - 1), time: s.time, weekday: s.weekday }));
  const chosen = pickTopics(topics, usedTopicIds(dir), slots.length, business);
  if (chosen.length < slots.length) log.warn("No hay suficientes temas elegibles para todos los espacios.", { needed: slots.length, available: chosen.length });

  const created = [];
  const calendarRows = [];
  chosen.forEach((topic, i) => {
    const slot = slots[i];
    const content = renderPost(topic, slot, business);
    const publishable = `${topic.es}\n\n${topic.en}`.replaceAll("{{link}}", "");
    const findings = lintText(publishable, { business, fileLabel: topic.id });
    if (findings.length) {
      log.error("Tema bloqueado por el verificador de afirmaciones.", { topic: topic.id, rules: findings.map((f) => f.rule) });
      return;
    }
    const file = path.join(weekDir, `${slot.date}-${topic.id}.md`);
    created.push({ file, topic: topic.id, date: slot.date, time: slot.time });
    calendarRows.push(`| ${WEEKDAYS_ES[slot.weekday]} ${slot.date} | ${slot.time} | ${topic.title_es} | ${topic.pillar} | \`${path.basename(file)}\` |`);
    if (write) {
      fs.mkdirSync(weekDir, { recursive: true });
      fs.writeFileSync(file, content);
    }
  });

  const calendar = [
    `# Calendario de publicaciones — semana ${week}`,
    "",
    `Hora de Texas (${business.timezone}). Canal: Facebook (${business.facebookUrl}).`,
    "",
    "| Día | Hora | Tema | Pilar | Archivo |",
    "| --- | --- | --- | --- | --- |",
    ...calendarRows,
    "",
    "## Cómo aprobar",
    "",
    "1. Lee cada borrador y corrige el texto si hace falta.",
    "2. En los que quieras publicar, cambia `status: \"draft\"` por `status: \"approved\"`.",
    "3. Aprueba y fusiona el Pull Request. Si la publicación automática está activada, Facebook las programa a la hora indicada; si no, copia la sección **Publicar** a mano.",
    "",
  ].join("\n");
  if (write && created.length) fs.writeFileSync(path.join(weekDir, "CALENDARIO.md"), calendar);

  log.info("Borradores generados.", { week, count: created.length, topics: created.map((c) => c.topic) });
  return { week, weekDir, created, calendar, skipped: false };
}

/* ---------- CLI ---------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--week-start");
  const weekStart = i !== -1 ? args[i + 1] : undefined;
  const dryRun = args.includes("--dry-run");
  const result = generateWeek({ weekStart, write: !dryRun });
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `week=${result.week}\ncreated=${result.created.length}\n`);
  }
  if (dryRun && result.calendar) console.log(result.calendar);
}
