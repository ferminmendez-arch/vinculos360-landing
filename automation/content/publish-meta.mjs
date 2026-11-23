/* =========================================================
   PUBLICADOR DE FACEBOOK (Meta Pages API) — DESACTIVADO POR DEFECTO

   Programa en la página de Facebook las publicaciones aprobadas.
   Solo actúa si se cumplen TODAS las condiciones:
   1. META_PUBLISH_ENABLED = "true" (variable del repositorio que
      define el dueño).
   2. Existen los secretos META_PAGE_ID y META_PAGE_TOKEN.
   3. La publicación tiene status "approved" y pasa el verificador
      de afirmaciones.
   4. La hora programada está entre 10 minutos y 29 días en el futuro.

   Este script solo crea publicaciones orgánicas (POST /{page}/feed).
   No crea anuncios ni promociona publicaciones: no puede gastar dinero.

   Reintentos: solo cuando Meta indica un error temporal (5xx, límite
   de uso, is_transient) o la conexión falló antes de enviar. Si la
   respuesta no llega (tiempo agotado), NO se reintenta para no
   duplicar la publicación; se informa como "sin verificar".

   Uso: node automation/content/publish-meta.mjs [--previous-ref REF] [archivos...]
========================================================= */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_DIR, createLogger, extractSection, loadBusiness, parseFrontMatter, withRetry } from "../lib/common.mjs";
import { collectPostFiles, lintPostFile } from "./claims-lint.mjs";

const MIN_LEAD_MS = 10 * 60 * 1000;
const MAX_LEAD_MS = 29 * 24 * 60 * 60 * 1000;
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613]);
const NETWORK_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"]);

export class PublishError extends Error {
  constructor(message, { retryable = false, unverified = false, status, code } = {}) {
    super(message);
    this.retryable = retryable;
    this.unverified = unverified;
    this.status = status;
    this.code = code;
  }
}

export function readConfig(env = process.env) {
  return {
    enabled: env.META_PUBLISH_ENABLED === "true",
    pageId: env.META_PAGE_ID || "",
    token: env.META_PAGE_TOKEN || "",
    graphVersion: env.META_GRAPH_VERSION || "v26.0",
    timeoutMs: Number(env.META_TIMEOUT_MS || 20000),
  };
}

/* Estado de la publicación en el commit anterior (para no programarla dos veces). */
export function gitPreviousStatus(ref) {
  return (file) => {
    try {
      const rel = path.relative(REPO_DIR, path.resolve(file)).split(path.sep).join("/");
      const text = execFileSync("git", ["show", `${ref}:${rel}`], { cwd: REPO_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return parseFrontMatter(text).data.status || "";
    } catch {
      return ""; // el archivo no existía antes
    }
  };
}

/* Decide qué hacer con cada archivo, sin llamar a Meta.
   `previousStatusOf(file)` devuelve el status anterior: si ya estaba
   "approved", la publicación ya se procesó y no se vuelve a programar. */
export function planPublications(files, { now = new Date(), business = loadBusiness(), previousStatusOf = () => "" } = {}) {
  return files.map((file) => {
    const { data, body } = parseFrontMatter(fs.readFileSync(file, "utf8"));
    const label = path.relative(REPO_DIR, file);
    const base = { file: label, topic: data.topic, scheduledUtc: data.scheduled_utc };
    if (data.channel !== "facebook") return { ...base, action: "skip", reason: "canal distinto de facebook" };
    if (data.status !== "approved") return { ...base, action: "skip", reason: `status=${data.status || "vacío"}` };
    if (previousStatusOf(file) === "approved") return { ...base, action: "skip", reason: "ya estaba aprobada antes (no se duplica)" };
    const findings = lintPostFile(file, { business });
    if (findings.length) return { ...base, action: "blocked", reason: findings.map((f) => f.rule).join(", ") };
    const message = extractSection(body, "Publicar");
    if (!message) return { ...base, action: "blocked", reason: "sección Publicar vacía" };
    const when = new Date(data.scheduled_utc);
    if (Number.isNaN(when.getTime())) return { ...base, action: "blocked", reason: "scheduled_utc inválido" };
    const lead = when.getTime() - now.getTime();
    if (lead < MIN_LEAD_MS) return { ...base, action: "skip", reason: "la hora programada ya pasó o es en menos de 10 minutos" };
    if (lead > MAX_LEAD_MS) return { ...base, action: "skip", reason: "la hora programada es en más de 29 días" };
    return { ...base, action: "publish", message, unixTime: Math.floor(when.getTime() / 1000) };
  });
}

export async function schedulePost(item, config, { fetchImpl = globalThis.fetch } = {}) {
  const url = `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.pageId)}/feed`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: item.message,
        published: false,
        scheduled_publish_time: item.unixTime,
        access_token: config.token,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new PublishError("Sin respuesta de Meta a tiempo: la publicación pudo o no haberse programado.", { unverified: true });
    }
    const code = error?.cause?.code || error?.code;
    throw new PublishError(`Error de conexión (${code || "desconocido"}).`, { retryable: NETWORK_CODES.has(code), code });
  } finally {
    clearTimeout(timer);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    json = {};
  }
  if (response.ok && json.id) return { id: json.id };

  const err = json.error || {};
  const retryable = response.status >= 500 || response.status === 429 || err.is_transient === true || TRANSIENT_CODES.has(err.code);
  // Nunca se incluye el token en el mensaje.
  throw new PublishError(`Meta respondió ${response.status}${err.code ? ` (código ${err.code})` : ""}: ${err.message || "sin detalle"}`, {
    retryable,
    status: response.status,
    code: err.code,
  });
}

export async function run(files, { env = process.env, now = new Date(), fetchImpl, sleep, logger, business = loadBusiness(), previousStatusOf } = {}) {
  const log = logger || createLogger("publicador");
  const config = readConfig(env);
  const plan = planPublications(files, { now, business, previousStatusOf });
  const results = [];

  for (const item of plan) {
    if (item.action !== "publish") {
      log.info("Sin publicar.", { file: item.file, action: item.action, reason: item.reason });
      results.push({ file: item.file, outcome: item.action, reason: item.reason });
      continue;
    }
    if (!config.enabled || !config.pageId || !config.token) {
      const reason = !config.enabled ? "publicación automática desactivada (META_PUBLISH_ENABLED)" : "faltan META_PAGE_ID o META_PAGE_TOKEN";
      log.info("Simulación: se programaría.", { file: item.file, scheduledUtc: item.scheduledUtc, reason });
      results.push({ file: item.file, outcome: "dry-run", reason });
      continue;
    }
    try {
      const res = await withRetry(() => schedulePost(item, config, { fetchImpl }), {
        attempts: 3,
        baseDelayMs: 2000,
        sleep,
        isRetryable: (e) => e instanceof PublishError && e.retryable,
        onRetry: (e, attempt, delay) => log.warn("Error temporal; se reintenta.", { file: item.file, attempt, delay, error: e.message }),
      });
      log.info("Programada en Facebook.", { file: item.file, postId: res.id, scheduledUtc: item.scheduledUtc });
      results.push({ file: item.file, outcome: "scheduled", postId: res.id });
    } catch (error) {
      const outcome = error.unverified ? "unverified" : "failed";
      log.error("No se pudo programar.", { file: item.file, outcome, error: error.message });
      results.push({ file: item.file, outcome, reason: error.message });
    }
  }
  return results;
}

/* ---------- CLI ---------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const refIdx = args.indexOf("--previous-ref");
  const previousRef = refIdx !== -1 ? args.splice(refIdx, 2)[1] : "";
  const files = collectPostFiles(args.length ? args : [path.join(REPO_DIR, "marketing", "posts")]);
  const results = await run(files, { previousStatusOf: previousRef ? gitPreviousStatus(previousRef) : undefined });
  const failed = results.filter((r) => r.outcome === "failed" || r.outcome === "unverified" || r.outcome === "blocked");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = results.map((r) => `| \`${r.file}\` | ${r.outcome} | ${r.postId || r.reason || ""} |`);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, ["### Publicador de Facebook", "", "| Archivo | Resultado | Detalle |", "| --- | --- | --- |", ...rows, ""].join("\n"));
  }
  if (failed.length) process.exitCode = 1;
}
