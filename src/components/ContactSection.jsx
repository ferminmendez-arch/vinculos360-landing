import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, MessageCircle, Phone, RotateCw } from "lucide-react";
import { SERVICES } from "../content.js";
import { useLang, useStrings } from "../i18n.js";
import { PHONE_DISPLAY, PHONE_E164 } from "../config.js";
import { getTrackingData } from "../lib/tracking.js";
import { buildLeadWhatsAppMessage, buildWhatsAppUrl } from "../lib/whatsapp.js";
import { cleanName, digitsOnly, formatUsPhone, validateLead } from "../lib/validation.js";
import {
  enqueueLead,
  rememberConfirmed,
  removeFromQueue,
  sendLead,
  wasRecentlyConfirmed,
} from "../lib/leads.js";
import { FacebookLink, WhatsAppLink } from "./ui.jsx";

const FIELD_ORDER = ["service", "name", "phone", "zipCode"];
const EMPTY_FORM = { name: "", phone: "", zipCode: "", company: "" };

function fieldId(field) {
  return field === "service" ? `servicio-${SERVICES[0].slug}` : field;
}

function trackEvent(name, params) {
  // Sin datos personales. Solo actúa si existe GTM o el píxel de Meta.
  try {
    window.dataLayer?.push({ event: name, ...params });
    if (name === "lead_confirmed") window.fbq?.("track", "Lead", { content_name: params.service });
  } catch {
    /* sin analítica */
  }
}

const inputBase =
  "block w-full rounded-2xl border bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-4";

function inputClass(hasError) {
  return `${inputBase} ${
    hasError
      ? "border-red-500 focus:border-red-600 focus:ring-red-100"
      : "border-slate-300 focus:border-brand-600 focus:ring-brand-100"
  }`;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
      <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export default function ContactSection({ selectedService, onSelectService }) {
  const t = useStrings();
  const lang = useLang();
  const c = t.contact;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const submittingRef = useRef(false);

  const isSubmitting = status === "submitting";

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const goToWhatsApp = (url) => {
    window.setTimeout(() => window.location.assign(url), 500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const values = { ...form, service: selectedService };
    const found = validateLead(values);
    setErrors(found);

    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      setStatus("idle");
      return;
    }

    // Campo trampa para bots: si viene lleno, no se envía nada.
    if (form.company) {
      setStatus("confirmed");
      return;
    }

    const name = cleanName(form.name);
    const zipCode = digitsOnly(form.zipCode);
    const payload = {
      name,
      phone: formatUsPhone(form.phone),
      zipCode,
      service: selectedService,
      ...getTrackingData(),
    };
    const serviceLabel = t.services.items[SERVICES.find((s) => s.value === selectedService).slug].title;
    const url = buildWhatsAppUrl(buildLeadWhatsAppMessage({ name, service: serviceLabel, zipCode }, lang));
    setWhatsappUrl(url);

    // La misma solicitud ya se registró hace poco: no se duplica.
    if (wasRecentlyConfirmed(payload)) {
      setStatus("confirmed");
      goToWhatsApp(url);
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    const result = await sendLead(payload);
    submittingRef.current = false;
    trackEvent(`lead_${result.status}`, { service: selectedService, language: lang });

    if (result.status === "confirmed") {
      rememberConfirmed(payload);
      removeFromQueue(payload);
      setStatus("confirmed");
      goToWhatsApp(url);
      return;
    }

    if (result.status === "rejected" || result.status === "offline") {
      // No se guardó: se conserva en este dispositivo para reintentar.
      enqueueLead(payload);
    }
    setStatus(result.status);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setStatus("idle");
  };

  return (
    <section id="contacto" aria-labelledby="contacto-title" className="bg-brand-950 py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-12 lg:px-8">
        <div className="lg:sticky lg:top-28">
          <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-brand-100 uppercase">
            {c.eyebrow}
          </p>
          <h2 id="contacto-title" className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl">
            {c.title}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
            {c.text}
          </p>

          <ul className="mt-8 space-y-3">
            {t.benefits.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base font-medium text-slate-100">
                <CircleCheck className="h-5 w-5 shrink-0 text-wa-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <a
              href={`tel:${PHONE_E164}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
              {PHONE_DISPLAY}
            </a>
            <WhatsAppLink variant="light" className="px-6 py-3.5">
              {c.whatsapp}
            </WhatsAppLink>
          </div>

          <FacebookLink variant="light" label className="mt-3 px-6 py-3.5" />

          <img
            src="/img/ilustraciones/asesoria.svg"
            alt=""
            width="480"
            height="320"
            loading="lazy"
            decoding="async"
            className="mt-10 hidden w-full max-w-md lg:block"
          />
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-2xl shadow-black/30 sm:p-8">
          {status === "confirmed" ? (
            <div role="status" className="py-6 text-center">
              <CircleCheck className="mx-auto h-14 w-14 text-wa-600" aria-hidden="true" />
              <h3 className="mt-4 text-2xl font-bold text-slate-900">{c.successTitle}</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                {c.successText}
              </p>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-wa-600 px-6 py-3.5 font-semibold text-white hover:bg-wa-700"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  {c.openWhatsapp}
                </a>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="mt-4 block w-full text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
              >
                {c.another}
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} aria-describedby="form-nota" className="space-y-5">
              <fieldset>
                <legend className="mb-3 block text-sm font-semibold text-slate-800">
                  {c.serviceLegend}
                </legend>
                <div
                  className="grid grid-cols-2 gap-2"
                  aria-describedby={errors.service ? "service-error" : undefined}
                >
                  {SERVICES.map((service) => {
                    const checked = selectedService === service.value;
                    return (
                      <label
                        key={service.value}
                        htmlFor={`servicio-${service.slug}`}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200 ${
                          checked
                            ? "border-brand-600 bg-brand-50 text-brand-800"
                            : errors.service
                              ? "border-red-300 text-slate-700 hover:border-red-400"
                              : "border-slate-200 text-slate-700 hover:border-brand-300"
                        }`}
                      >
                        <input
                          id={`servicio-${service.slug}`}
                          type="radio"
                          name="service"
                          value={service.value}
                          checked={checked}
                          onChange={() => {
                            onSelectService(service.value);
                            if (errors.service) setErrors((prev) => ({ ...prev, service: undefined }));
                          }}
                          className="sr-only"
                        />
                        {checked && <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        {t.services.items[service.slug].title}
                      </label>
                    );
                  })}
                </div>
                <FieldError id="service-error" message={t.errors[errors.service]} />
              </fieldset>

              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-800">
                  {c.name}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  maxLength={80}
                  placeholder={c.namePlaceholder}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  className={inputClass(errors.name)}
                />
                <FieldError id="name-error" message={t.errors[errors.name]} />
              </div>

              <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-slate-800">
                    {c.phone}
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(281) 555-1234"
                    value={form.phone}
                    onChange={(e) => update("phone", formatUsPhone(e.target.value))}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                    className={inputClass(errors.phone)}
                  />
                  <FieldError id="phone-error" message={t.errors[errors.phone]} />
                </div>

                <div>
                  <label htmlFor="zipCode" className="mb-2 block text-sm font-semibold text-slate-800">
                    {c.zip}
                  </label>
                  <input
                    id="zipCode"
                    name="zipCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    placeholder="77494"
                    value={form.zipCode}
                    onChange={(e) => update("zipCode", digitsOnly(e.target.value).slice(0, 5))}
                    aria-invalid={Boolean(errors.zipCode)}
                    aria-describedby={errors.zipCode ? "zipCode-error" : undefined}
                    className={inputClass(errors.zipCode)}
                  />
                  <FieldError id="zipCode-error" message={t.errors[errors.zipCode]} />
                </div>
              </div>

              {/* Campo trampa anti-spam: oculto para personas */}
              <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="company">{c.honeypot}</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                />
              </div>

              <div aria-live="polite">
                {(status === "rejected" || status === "offline") && (
                  <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <p className="font-semibold">
                      {status === "offline"
                        ? c.offlineTitle
                        : c.rejectedTitle}
                    </p>
                    <p className="mt-1 leading-6">{c.failedText}</p>
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        className="mt-3 inline-flex items-center gap-2 font-semibold text-wa-700 underline underline-offset-4"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        {c.sendByWhatsapp}
                      </a>
                    )}
                  </div>
                )}

                {status === "unverified" && (
                  <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">{c.unverifiedTitle}</p>
                    <p className="mt-1 leading-6">{c.unverifiedText}</p>
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-wa-600 px-5 py-3 text-base font-semibold text-white hover:bg-wa-700"
                      >
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                        {c.submit}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {status !== "unverified" && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-wa-600 px-6 py-4 text-base font-semibold text-white shadow-md shadow-wa-600/20 transition-colors hover:bg-wa-700 disabled:cursor-wait disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                      {c.sending}
                    </>
                  ) : status === "rejected" || status === "offline" ? (
                    <>
                      <RotateCw className="h-5 w-5" aria-hidden="true" />
                      {c.retry}
                    </>
                  ) : (
                    <>
                      {c.submit}
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}

              <p id="form-nota" className="text-center text-xs leading-5 text-slate-500">
                {c.privacy}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
