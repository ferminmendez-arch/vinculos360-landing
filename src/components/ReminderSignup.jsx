import { useId, useRef, useState } from "react";
import { BellRing, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { fmtDate } from "../lib/analyzerStrings.js";
import { buildReminderPayload, validateReminder } from "../lib/billAnalyzer.js";
import { submitChatLead, toSheetPayload, trackChatEvent } from "../lib/chatbot/api.js";
import { enqueueLead, rememberConfirmed, removeFromQueue, wasRecentlyConfirmed } from "../lib/leads.js";
import { getTrackingData } from "../lib/tracking.js";
import { trackEvent } from "../lib/analytics.js";

/* Recordatorio de vencimiento: el visitante deja su WhatsApp con consentimiento y el dueño
   le escribe unas semanas antes del vencimiento (el agente de leads le avisa). No abre
   WhatsApp ni confirma nada que no se haya guardado. */
export default function ReminderSignup({ analyzer, lang, s }) {
  const uid = useId();
  const ids = { contractEnd: `${uid}-end`, name: `${uid}-name`, phone: `${uid}-phone`, email: `${uid}-email`, consent: `${uid}-consent` };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contractEnd: analyzer.contractEnd || "", name: "", phone: "", email: "", consent: false, company: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | submitting | confirmed | rejected | offline | unverified
  const openedAt = useRef(0);
  const submitting = useRef(false);

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const start = () => {
    openedAt.current = performance.now();
    setOpen(true);
    window.requestAnimationFrame(() => document.getElementById(analyzer.contractEnd ? ids.name : ids.contractEnd)?.focus());
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || status === "confirmed") return;
    const checked = validateReminder(form);
    if (checked.errors) {
      setErrors(checked.errors);
      const first = ["contractEnd", "name", "phone", "email", "consent"].find((f) => checked.errors[f]);
      document.getElementById(ids[first])?.focus();
      return;
    }
    setErrors({});
    const payload = {
      ...buildReminderPayload(analyzer, checked.values, {
        language: lang,
        tracking: getTrackingData(),
        elapsedMs: performance.now() - (openedAt.current || performance.now()),
      }),
      company: form.company,
    };
    const sheetPayload = toSheetPayload(payload);
    if (form.company || wasRecentlyConfirmed(sheetPayload)) {
      setStatus("confirmed");
      return;
    }
    submitting.current = true;
    setStatus("submitting");
    const result = await submitChatLead(payload);
    submitting.current = false;
    if (result.status === "confirmed") {
      rememberConfirmed(sheetPayload);
      removeFromQueue(sheetPayload);
      trackChatEvent("reminder_signup", { language: lang, serviceKey: "electricidad" });
      trackEvent("lead_submitted", { language: lang, service: "electricidad", entry_point: "recordatorio" });
      setStatus("confirmed");
      return;
    }
    if (result.status === "rejected" || result.status === "offline") enqueueLead(sheetPayload);
    setStatus(result.status);
  };

  const r = s.reminder;
  const inputClass = (field) =>
    `mt-1 block min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-base text-slate-900 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none ${
      errors[field] ? "border-red-500" : "border-slate-300"
    }`;
  const describedBy = (field) => (errors[field] ? `${ids[field]}-error` : undefined);
  const errorText = (field) =>
    errors[field] ? (
      <p id={`${ids[field]}-error`} className="mt-1 text-sm font-medium text-red-700">
        {r.errors[errors[field]] || r.errors.date_invalid}
      </p>
    ) : null;

  if (status === "confirmed") {
    return (
      <div className="mt-5 rounded-2xl border border-wa-600/40 bg-wa-50 p-4 text-wa-700" role="status">
        <p className="flex items-center gap-2 font-bold">
          <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          {r.success(form.name.trim().split(" ")[0] || "", fmtDate(form.contractEnd, lang))}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{r.successNote}</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="flex items-center gap-2 font-bold text-slate-900">
        <BellRing className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
        {r.title}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{r.text}</p>
      {!open ? (
        <button
          type="button"
          onClick={start}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-brand-700 bg-white px-5 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          {r.open}
        </button>
      ) : (
        <form onSubmit={submit} noValidate className="mt-3 space-y-3" aria-label={r.title}>
          {!analyzer.contractEnd && (
            <div>
              <label htmlFor={ids.contractEnd} className="block text-sm font-semibold text-slate-800">
                {r.date}
              </label>
              <input id={ids.contractEnd} type="date" value={form.contractEnd} onChange={update("contractEnd")} aria-invalid={Boolean(errors.contractEnd)} aria-describedby={describedBy("contractEnd")} className={inputClass("contractEnd")} />
              {errorText("contractEnd")}
            </div>
          )}
          <div>
            <label htmlFor={ids.name} className="block text-sm font-semibold text-slate-800">
              {r.name}
            </label>
            <input id={ids.name} autoComplete="given-name" value={form.name} onChange={update("name")} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} className={inputClass("name")} />
            {errorText("name")}
          </div>
          <div>
            <label htmlFor={ids.phone} className="block text-sm font-semibold text-slate-800">
              {r.phone}
            </label>
            <input id={ids.phone} type="tel" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={update("phone")} aria-invalid={Boolean(errors.phone)} aria-describedby={describedBy("phone")} placeholder="(713) 555-0123" className={inputClass("phone")} />
            {errorText("phone")}
          </div>
          <div>
            <label htmlFor={ids.email} className="block text-sm font-semibold text-slate-800">
              {r.email} <span className="font-normal text-slate-500">({r.optional})</span>
            </label>
            <input id={ids.email} type="email" autoComplete="email" value={form.email} onChange={update("email")} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email")} className={inputClass("email")} />
            {errorText("email")}
          </div>
          {/* Campo trampa para robots: oculto para personas y lectores de pantalla. */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={update("company")} className="hidden" aria-hidden="true" />
          <div>
            <label htmlFor={ids.consent} className="flex gap-2.5 text-xs leading-5 text-slate-600">
              <input id={ids.consent} type="checkbox" checked={form.consent} onChange={update("consent")} aria-invalid={Boolean(errors.consent)} aria-describedby={describedBy("consent")} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" />
              <span>{r.consent}</span>
            </label>
            {errorText("consent")}
          </div>
          {(status === "rejected" || status === "offline" || status === "unverified") && (
            <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
              {r[status]}
            </p>
          )}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-800 focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-70"
          >
            {status === "submitting" ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            {status === "submitting" ? r.sending : r.submit}
          </button>
        </form>
      )}
    </div>
  );
}
