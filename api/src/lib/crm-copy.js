// Copia secundaria. Sheets conserva la solicitud y la misma clave para reconciliación.
import { createHmac } from "node:crypto";
import { analyzerFields } from "./sinks.js";

const CRM_ENDPOINTS = new Set([
  "https://crm.vinculos360.com/api/ingest/lead",
  "https://kind-river-0a4356110-preview.centralus.4.azurestaticapps.net/api/ingest/lead",
]);
const CONTACT_METHODS = { whatsapp: "whatsapp", llamada: "phone", texto: "sms", correo: "email" };
const OUTCOMES = new Set(["created", "already_received", "merged_into_existing"]);
const RETRYABLE = new Set([408, 500, 502, 503, 504]);

function payloadFor(lead, { id, receivedAt, tdu }) {
  const { billAmount, monthlyKwh, effectiveCentsKwh, contractExpiration } = analyzerFields(lead);
  const bill = {
    ...(billAmount && { billAmount: Number(billAmount) }),
    ...(monthlyKwh && { monthlyKwh: Number(monthlyKwh) }),
    ...(effectiveCentsKwh && { centsPerKwh: Number(effectiveCentsKwh) }),
    ...(contractExpiration && { contractEnd: contractExpiration }),
    ...(tdu && { tdu: tdu.slice(0, 80) }),
  };
  return {
    externalKey: id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email || undefined,
    zip: lead.zipCode,
    serviceKey: lead.serviceKey,
    sourceKey: lead.entry === "chat" ? "chatbot" : "analyzer",
    campaign: lead.campaign.slice(0, 120),
    medium: lead.medium.slice(0, 120),
    content: lead.ad.slice(0, 120),
    language: lead.language,
    preferredContact: CONTACT_METHODS[lead.preferredContact],
    consentGranted: lead.consent,
    consentVersion: lead.consentVersion,
    consentAt: receivedAt,
    ...(Object.keys(bill).length > 0 && { bill }),
  };
}

export async function copyLeadToCrm(lead, meta, { env, fetchImpl, now }) {
  const endpoint = String(env.CRM_INGEST_URL ?? "").trim();
  const secret = env.CRM_INGEST_SECRET;
  if (!CRM_ENDPOINTS.has(endpoint) || typeof secret !== "string" || Buffer.byteLength(secret) < 32)
    return { ok: false, reason: "invalid_configuration" };

  const body = JSON.stringify(payloadFor(lead, meta));
  let reason;
  for (let attempt = 0; attempt < 2; attempt++) {
    const timestamp = String(now().getTime());
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-V360-Timestamp": timestamp,
          "X-V360-Signature": signature,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(2000),
      });
      if (res.status === 200 || res.status === 201) {
        const data = await res.json().catch(() => null);
        if (data?.ok === true && OUTCOMES.has(data.outcome) && typeof data.leadId === "string" && data.leadId)
          return { ok: true };
        return { ok: false, reason: "unverified_response" };
      }
      reason = `http_${res.status}`;
      if (!RETRYABLE.has(res.status)) break;
    } catch {
      reason = "network_or_timeout";
    }
  }
  return { ok: false, reason };
}
