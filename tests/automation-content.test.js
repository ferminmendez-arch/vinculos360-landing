/* Pruebas del Agente 1 (contenido) y del publicador de Facebook. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addDays, isoWeek, nextMonday, parseFrontMatter, withRetry, zonedToUtc } from "../automation/lib/common.mjs";
import { lintPostFile, lintText } from "../automation/content/claims-lint.mjs";
import { buildLink, generateWeek, loadTopics, pickTopics } from "../automation/content/generate.mjs";
import { planPublications, run } from "../automation/content/publish-meta.mjs";

const business = JSON.parse(fs.readFileSync(new URL("../automation/config/business.json", import.meta.url), "utf8"));
const quietLogger = { info() {}, warn() {}, error() {}, entries: [] };

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "v360-"));
}

/* ---------- Fechas ---------- */

test("zonedToUtc convierte hora de Texas con horario de invierno y verano", () => {
  assert.equal(zonedToUtc("2026-12-01", "19:00", "America/Chicago").toISOString(), "2026-12-02T01:00:00.000Z");
  assert.equal(zonedToUtc("2026-07-01", "19:00", "America/Chicago").toISOString(), "2026-07-02T00:00:00.000Z");
});

test("nextMonday, addDays e isoWeek", () => {
  assert.equal(nextMonday(new Date("2026-11-27T18:00:00Z"), "America/Chicago"), "2026-11-30");
  assert.equal(nextMonday(new Date("2026-11-30T18:00:00Z"), "America/Chicago"), "2026-12-07");
  assert.equal(addDays("2026-12-28", 5), "2027-01-02");
  assert.equal(isoWeek("2026-11-30"), "2026-W49");
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
});

/* ---------- Verificador de afirmaciones ---------- */

test("el banco de temas pasa el verificador (ES y EN)", () => {
  for (const t of loadTopics()) {
    // Los temas con `requires` solo se usan cuando el dueño confirma ese dato.
    const ctx = structuredClone(business);
    for (const r of t.requires || []) ctx.commercialFacts[r] = { verified: true, value: "confirmado" };
    assert.deepEqual(lintText(t.es, { business: ctx }), [], `es: ${t.id}`);
    assert.deepEqual(lintText(t.en, { business: ctx }), [], `en: ${t.id}`);
    assert.ok(t.sources.length > 0, `fuentes: ${t.id}`);
    assert.match(t.es, /\{\{link\}\}/, `CTA: ${t.id}`);
  }
});

test("bloquea promesas de ahorro, precios, garantías, 'gratis' y proveedores", () => {
  const cases = {
    "savings-amount": "Ahorra hasta $300 al año con nosotros",
    "percent-or-money-claim": "Planes desde 9.9¢ por kWh",
    guarantee: "Te conseguimos el plan más barato, garantizado",
    free: "Asesoría gratis para ti",
    credential: "Somos corredores registrados ante la PUCT",
    testimonial: "Mira este testimonio de cliente",
    "provider-name": "Trabajamos con Reliant y TXU",
  };
  for (const [rule, text] of Object.entries(cases)) {
    const rules = lintText(text, { business }).map((f) => f.rule);
    assert.ok(rules.includes(rule), `${rule}: ${rules.join(",")}`);
  }
});

test("el proveedor de seguridad nunca puede aparecer en contenido público", () => {
  const rules = lintText("Cámaras con Vivint", { business }).map((f) => f.rule);
  assert.ok(rules.includes("provider-name"));
});

test("las marcas de la red de distribución nunca aparecen en contenido público", () => {
  for (const text of ["Plan de XOOM Energy", "Únete a ACN", "ferminmendez.acnibo.com/us-en", "Protección con IDSeal", "TV con DIRECTV"]) {
    const rules = lintText(text, { business }).map((f) => f.rule);
    assert.ok(rules.includes("provider-name"), text);
  }
});

test("'gratis' se permite solo cuando el dueño lo confirma", () => {
  const confirmed = structuredClone(business);
  confirmed.commercialFacts.serviceIsFreeForCustomer = { verified: true, value: true };
  assert.deepEqual(lintText("Asesoría gratis para ti", { business: confirmed }), []);
});

test("no confunde teléfonos ni kWh con precios", () => {
  assert.deepEqual(lintText("Llama a la PUCT: 1-888-782-8477. Compara a 500, 1,000 y 2,000 kWh.", { business }), []);
});

/* ---------- Generador ---------- */

test("omite temas que dependen de datos comerciales no confirmados", () => {
  const ids = pickTopics(loadTopics(), [], 50, business).map((t) => t.id);
  assert.ok(!ids.includes("corredores-registrados"));
  const confirmed = structuredClone(business);
  confirmed.commercialFacts.puctBrokerRegistration = { verified: true, value: "Registro BR000" };
  assert.ok(pickTopics(loadTopics(), [], 50, confirmed).some((t) => t.id === "corredores-registrados"));
});

test("rota temas: primero los nunca usados y sin repetir pilar seguido", () => {
  const topics = loadTopics();
  const used = topics.slice(0, 5).map((t) => t.id);
  const picked = pickTopics(topics, used, 3, business);
  assert.equal(picked.length, 3);
  picked.forEach((t) => assert.ok(!used.includes(t.id)));
  for (let i = 1; i < picked.length; i += 1) assert.notEqual(picked[i].pillar, picked[i - 1].pillar);
});

test("genera la semana como borradores, con UTM y calendario, sin sobrescribir", () => {
  const dir = tmpDir();
  const first = generateWeek({ weekStart: "2026-12-07", business, postsDir: dir, logger: quietLogger });
  assert.equal(first.created.length, 3);
  assert.ok(fs.existsSync(path.join(dir, "2026-W50", "CALENDARIO.md")));
  for (const c of first.created) {
    const { data, body } = parseFrontMatter(fs.readFileSync(c.file, "utf8"));
    assert.equal(data.status, "draft");
    assert.equal(data.channel, "facebook");
    assert.match(body, /utm_content=/);
    assert.deepEqual(lintPostFile(c.file, { business }), []);
  }
  const again = generateWeek({ weekStart: "2026-12-07", business, postsDir: dir, logger: quietLogger });
  assert.equal(again.skipped, true);
  const next = generateWeek({ weekStart: "2026-12-14", business, postsDir: dir, logger: quietLogger });
  const overlap = next.created.filter((c) => first.created.some((f) => f.topic === c.topic));
  assert.equal(overlap.length, 0, "no repite temas de la semana anterior");
});

test("buildLink arma enlaces ES/EN con servicio y UTM", () => {
  const url = new URL(buildLink(business, "efl-que-es", "en"));
  assert.equal(url.pathname, "/en/");
  assert.equal(url.searchParams.get("service"), "electricidad");
  assert.equal(url.searchParams.get("utm_content"), "efl-que-es");
});

/* ---------- Publicador ---------- */

function writeWeek(statusFor = () => "approved") {
  const dir = tmpDir();
  const res = generateWeek({ weekStart: "2026-12-07", business, postsDir: dir, logger: quietLogger });
  for (const c of res.created) {
    const text = fs.readFileSync(c.file, "utf8").replace('status: "draft"', `status: "${statusFor(c)}"`);
    fs.writeFileSync(c.file, text);
  }
  return res.created.map((c) => c.file);
}

const NOW = new Date("2026-12-05T12:00:00Z");
const ENABLED = { META_PUBLISH_ENABLED: "true", META_PAGE_ID: "123", META_PAGE_TOKEN: "secreto-de-prueba" };
const noSleep = async () => {};

test("solo publica lo aprobado y bloquea lo que no pasa el verificador", () => {
  const files = writeWeek((c) => (c.topic === "efl-que-es" ? "draft" : "approved"));
  const tampered = files.find((f) => !f.includes("efl-que-es"));
  fs.writeFileSync(tampered, fs.readFileSync(tampered, "utf8").replace("## Publicar\n", "## Publicar\n\nAhorra 30% garantizado.\n"));
  const plan = planPublications(files, { now: NOW, business });
  assert.deepEqual(plan.map((p) => p.action).sort(), ["blocked", "publish", "skip"].sort());
});

test("sin META_PUBLISH_ENABLED solo simula (no llama a Meta)", async () => {
  const files = writeWeek();
  let calls = 0;
  const results = await run(files, { env: {}, now: NOW, business, logger: quietLogger, fetchImpl: async () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.ok(results.every((r) => r.outcome === "dry-run"));
});

test("programa con published=false y hora futura; nunca expone el token", async () => {
  const files = writeWeek();
  const bodies = [];
  const results = await run(files, {
    env: ENABLED, now: NOW, business, logger: quietLogger, sleep: noSleep,
    fetchImpl: async (url, init) => {
      assert.match(url, /^https:\/\/graph\.facebook\.com\/v\d+\.0\/123\/feed$/);
      bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ id: `123_${bodies.length}` }) };
    },
  });
  assert.equal(results.filter((r) => r.outcome === "scheduled").length, 3);
  bodies.forEach((b) => {
    assert.equal(b.published, false);
    assert.ok(b.scheduled_publish_time * 1000 > NOW.getTime());
    assert.match(b.message, /utm_source=facebook/);
  });
});

test("reintenta errores temporales de Meta y luego funciona", async () => {
  const [file] = writeWeek();
  let calls = 0;
  const results = await run([file], {
    env: ENABLED, now: NOW, business, logger: quietLogger, sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 503, json: async () => ({ error: { message: "temporal", code: 2 } }) };
      return { ok: true, status: 200, json: async () => ({ id: "123_9" }) };
    },
  });
  assert.equal(calls, 2);
  assert.equal(results[0].outcome, "scheduled");
});

test("no reintenta errores de permisos y reporta la falla", async () => {
  const [file] = writeWeek();
  let calls = 0;
  const results = await run([file], {
    env: ENABLED, now: NOW, business, logger: quietLogger, sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 403, json: async () => ({ error: { message: "Permisos insuficientes", code: 200 } }) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(results[0].outcome, "failed");
  assert.ok(!results[0].reason.includes("secreto-de-prueba"));
});

test("si Meta no responde a tiempo no reintenta (evita duplicar) y lo marca sin verificar", async () => {
  const [file] = writeWeek();
  let calls = 0;
  const results = await run([file], {
    env: { ...ENABLED, META_TIMEOUT_MS: "20" }, now: NOW, business, logger: quietLogger, sleep: noSleep,
    fetchImpl: (url, init) => {
      calls += 1;
      return new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" }))));
    },
  });
  assert.equal(calls, 1);
  assert.equal(results[0].outcome, "unverified");
});

test("no vuelve a programar una publicación que ya estaba aprobada (p. ej., al corregir un error de dedo)", () => {
  const files = writeWeek();
  const plan = planPublications(files, { now: NOW, business, previousStatusOf: () => "approved" });
  assert.ok(plan.every((p) => p.action === "skip" && /ya estaba aprobada/.test(p.reason)));
});

test("no programa publicaciones cuya hora ya pasó", () => {
  const files = writeWeek();
  const plan = planPublications(files, { now: new Date("2026-12-20T00:00:00Z"), business });
  assert.ok(plan.every((p) => p.action === "skip"));
});

test("withRetry respeta isRetryable", async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n += 1; throw new Error("x"); }, { attempts: 3, isRetryable: () => false, sleep: noSleep }));
  assert.equal(n, 1);
});
