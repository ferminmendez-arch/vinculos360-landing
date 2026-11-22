import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// localStorage mínimo para Node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const leads = await import("../src/lib/leads.js");
const { interpretResponse, sendLead, wasRecentlyConfirmed, rememberConfirmed, enqueueLead, flushQueue } = leads;

const payload = {
  name: "Prueba QA",
  phone: "(281) 555-0100",
  zipCode: "77494",
  service: "Internet",
  source: "Direct",
  medium: "",
  campaign: "",
  ad: "",
  fbclid: "",
  device: "Desktop",
};

beforeEach(() => store.clear());

test("interpreta respuestas JSON de Apps Script", () => {
  assert.equal(interpretResponse(200, '{"result":"success"}').status, "confirmed");
  assert.equal(interpretResponse(200, '{"status":"ok"}').status, "confirmed");
  assert.equal(interpretResponse(200, '{"result":"error","error":"x"}').status, "rejected");
  assert.equal(interpretResponse(200, '{"ok":false}').status, "rejected");
});

test("interpreta texto plano y páginas de error", () => {
  assert.equal(interpretResponse(200, "Success").status, "confirmed");
  assert.equal(interpretResponse(200, "").status, "confirmed");
  assert.equal(interpretResponse(200, "<html>The script completed but did not return anything.</html>").status, "confirmed");
  assert.equal(interpretResponse(200, "<html><title>Error</title>TypeError: Cannot read properties of undefined</html>").status, "rejected");
  assert.equal(interpretResponse(500, "oops").status, "rejected");
  assert.equal(interpretResponse(404, "").status, "rejected");
});

test("envía los mismos campos que producción como text/plain", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return new Response('{"result":"success"}', { status: 200 });
  };
  const result = await sendLead(payload, { endpoint: "https://example.test/exec", fetchImpl });
  assert.equal(result.status, "confirmed");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.equal(captured.init.mode, undefined, "no debe usar no-cors");
  assert.deepEqual(Object.keys(JSON.parse(captured.init.body)).sort(), Object.keys(payload).sort());
});

test("respuesta ilegible (CORS) => unverified, nunca confirmed", async () => {
  const fetchImpl = async () => {
    throw new TypeError("Failed to fetch");
  };
  const result = await sendLead(payload, { endpoint: "https://example.test/exec", fetchImpl });
  assert.equal(result.status, "unverified");
});

test("timeout => unverified", async () => {
  const fetchImpl = (url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  const result = await sendLead(payload, { endpoint: "https://example.test/exec", fetchImpl, timeoutMs: 30 });
  assert.equal(result.status, "unverified");
});

test("prevención de duplicados por teléfono + servicio", () => {
  assert.equal(wasRecentlyConfirmed(payload), false);
  rememberConfirmed(payload, 1_000);
  assert.equal(wasRecentlyConfirmed(payload, 1_000 + 60_000), true);
  assert.equal(wasRecentlyConfirmed({ ...payload, service: "Electricidad" }, 1_000 + 60_000), false);
  assert.equal(wasRecentlyConfirmed(payload, 1_000 + 31 * 60_000), false);
  assert.ok(!store.get("v360_last_lead").includes("Prueba"), "no guarda el nombre");
});

test("la cola reintenta leads fallidos y se vacía al confirmarse", async () => {
  enqueueLead(payload);
  let calls = 0;
  await flushQueue({ endpoint: "https://example.test/exec", fetchImpl: async () => { calls++; return new Response("error", { status: 500 }); } });
  assert.equal(calls, 1);
  assert.equal(JSON.parse(store.get("v360_pending_leads")).length, 1);
  await flushQueue({ endpoint: "https://example.test/exec", fetchImpl: async () => { calls++; return new Response('{"result":"success"}'); } });
  assert.equal(calls, 2);
  assert.equal(store.has("v360_pending_leads"), false);
  assert.equal(wasRecentlyConfirmed(payload), true);
});
