import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, LoaderCircle, MessageCircle, RotateCcw, RotateCw, Send, X } from "lucide-react";
import { CHAT_STRINGS, resolveText } from "../lib/chatbot/strings.js";
import {
  INITIAL_STATE,
  SKIP,
  answer,
  answeredSteps,
  back,
  buildLeadPayload,
  checkInput,
  estimateSavings,
  nextStep,
  prequalify,
  valueOf,
} from "../lib/chatbot/flow.js";
import { submitChatLead, toSheetPayload, trackChatEvent } from "../lib/chatbot/api.js";
import { enqueueLead, rememberConfirmed, removeFromQueue, wasRecentlyConfirmed } from "../lib/leads.js";
import { getTrackingData } from "../lib/tracking.js";
import { buildWhatsAppUrl } from "../lib/whatsapp.js";
import { digitsOnly, formatUsPhone } from "../lib/validation.js";

/* ---------- Textos de cada paso ---------- */

function questionText(s, state, stepId) {
  if (stepId === "service") return s.serviceQuestion;
  if (stepId.startsWith("q:")) return resolveText(s.questions[stepId.slice(2)].text, state.answers);
  if (stepId === "zipCode") return resolveText(s.zipQuestion, state.answers);
  if (stepId === "name") return s.nameQuestion;
  if (stepId === "preferredContact") return s.contactQuestion(state.name);
  if (stepId === "phone") return s.phoneQuestion(state.preferredContact);
  if (stepId === "email") return s.emailQuestion;
  if (stepId === "consent") return s.consentQuestion;
  return "";
}

function optionLabel(s, state, stepId, value) {
  if (stepId === "service") return s.services[value];
  if (stepId.startsWith("q:")) return resolveText(s.questions[stepId.slice(2)].options, state.answers)[value];
  if (stepId === "preferredContact") return s.methods[value];
  return value;
}

function answerLabel(s, state, step) {
  const value = valueOf(state, step.id);
  if (step.kind === "number") {
    if (value === SKIP) return s.skipNumber;
    const q = s.questions[step.id.slice(2)];
    const n = Number(value).toLocaleString("en-US");
    return `${q.prefix || ""}${n}${q.suffix ? ` ${q.suffix}` : ""}`;
  }
  return step.kind === "choice" ? optionLabel(s, state, step.id, value) : value;
}

/* Propiedades del campo de texto para cada paso escrito. */
function inputFor(s, step, state) {
  if (step.kind === "number") {
    const q = s.questions[step.id.slice(2)];
    return { ...INPUTS.number, label: resolveText(q.text, state.answers), placeholder: q.placeholder };
  }
  return { ...INPUTS[step.id], label: s.labels[step.id], placeholder: s.placeholders[step.id === "zipCode" ? "zip" : step.id] };
}

const INPUTS = {
  zipCode: { type: "text", inputMode: "numeric", autoComplete: "postal-code", maxLength: 5, format: (v) => digitsOnly(v).slice(0, 5) },
  name: { type: "text", autoComplete: "name", autoCapitalize: "words", maxLength: 80, format: (v) => v },
  phone: { type: "tel", inputMode: "tel", autoComplete: "tel-national", maxLength: 14, format: (v) => formatUsPhone(v) },
  number: { type: "text", inputMode: "decimal", autoComplete: "off", maxLength: 10, format: (v) => v.replace(/[^\d.,$]/g, "") },
  email: { type: "email", inputMode: "email", autoComplete: "email", maxLength: 120, format: (v) => v },
};

/* ---------- Burbujas ---------- */

function BotBubble({ children }) {
  return (
    <div className="flex items-end gap-2">
      <img src="/favicon-48.png" alt="" width="28" height="28" className="h-7 w-7 shrink-0 rounded-full bg-white ring-1 ring-slate-200" />
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm ring-1 ring-slate-200">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children, label }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-[15px] leading-6 text-white">
        <span className="sr-only">{label}: </span>
        {children}
      </p>
    </div>
  );
}

/* ---------- Panel ---------- */

export default function ChatPanel({ open, onClose, lang }) {
  const s = CHAT_STRINGS[lang] || CHAT_STRINGS.es;
  const [state, setState] = useState(INITIAL_STATE);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | confirmed | rejected | offline | unverified
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const openedAt = useRef(0);
  const startedRef = useRef(false);
  const submittingRef = useRef(false);
  const logRef = useRef(null);
  const panelRef = useRef(null);
  const focusRef = useRef(null);

  const step = nextStep(state);
  const done = status === "confirmed";
  const locked = status === "submitting" || done;

  useEffect(() => {
    if (!openedAt.current) openedAt.current = performance.now();
  }, []);

  // Escape cierra el chat.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Al abrir y en cada pregunta nueva, el foco va al control de respuesta.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      (focusRef.current || panelRef.current)?.focus({ preventScroll: true });
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, step?.id, status]);

  const choose = (value) => {
    if (locked || !step) return;
    if (step.id === "service" && !startedRef.current) {
      startedRef.current = true;
      trackChatEvent("chat_start", { language: lang, serviceKey: value });
    }
    setState((prev) => answer(prev, step.id, value));
    setDraft("");
    setInputError("");
    setStatus("idle");
  };

  const submitInput = (event) => {
    event.preventDefault();
    if (locked || !step) return;
    const checked = checkInput(step.id, draft, state);
    if (checked.error) {
      setInputError(s.errors[checked.error] || checked.error);
      return;
    }
    setState((prev) => answer(prev, step.id, checked.value));
    setDraft("");
    setInputError("");
  };

  const goBack = () => {
    if (locked) return;
    setState((prev) => back(prev));
    setDraft("");
    setInputError("");
    setConsentError(false);
    setStatus("idle");
  };

  const restart = () => {
    setState(INITIAL_STATE);
    setDraft("");
    setInputError("");
    setConsent(false);
    setConsentError(false);
    setStatus("idle");
    setWhatsappUrl("");
  };

  const sendRequest = async (event) => {
    event.preventDefault();
    if (submittingRef.current || done) return;
    if (!consent) {
      setConsentError(true);
      return;
    }
    const tracking = getTrackingData();
    const payload = {
      ...buildLeadPayload(state, { language: lang, tracking, elapsedMs: performance.now() - openedAt.current, consent }),
      company,
    };
    const sheetPayload = toSheetPayload(payload);
    const url = buildWhatsAppUrl(
      s.whatsappMessage({ name: state.name, service: s.services[state.serviceKey], zipCode: state.zipCode, method: state.preferredContact })
    );
    setWhatsappUrl(url);

    // Campo trampa: una persona nunca lo ve ni lo llena.
    if (company) {
      setStatus("confirmed");
      return;
    }
    // La misma solicitud ya se registró hace poco: no se duplica.
    if (wasRecentlyConfirmed(sheetPayload)) {
      setStatus("confirmed");
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    const result = await submitChatLead(payload);
    submittingRef.current = false;

    if (result.status === "confirmed") {
      rememberConfirmed(sheetPayload);
      removeFromQueue(sheetPayload);
      setStatus("confirmed");
      const qualified = result.via === "api" ? result.prequalified : prequalify(state).prequalified;
      trackChatEvent("chat_complete", { language: lang, serviceKey: state.serviceKey });
      if (qualified) trackChatEvent("chat_qualified", { language: lang, serviceKey: state.serviceKey });
      try {
        window.fbq?.("track", "Lead", { content_name: sheetPayload.service });
      } catch {
        /* sin píxel */
      }
      return;
    }
    if (result.status === "rejected" || result.status === "offline") {
      // No se guardó: queda en este dispositivo para reintentar en la próxima visita.
      enqueueLead(sheetPayload);
    }
    setStatus(result.status);
  };

  const answered = answeredSteps(state);
  const savings = estimateSavings(state);

  return (
    <section
      id="v360-chat"
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="v360-chat-title"
      hidden={!open}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 outline-none md:inset-auto md:right-6 md:bottom-24 md:h-[min(640px,calc(100vh-8rem))] md:w-[400px] md:overflow-hidden md:rounded-3xl md:shadow-2xl md:shadow-brand-950/30 md:ring-1 md:ring-slate-200"
    >
      {/* Encabezado */}
      <header className="flex shrink-0 items-center gap-3 bg-brand-800 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
        <img src="/favicon-48.png" alt="" width="40" height="40" className="h-10 w-10 rounded-full bg-white p-0.5" />
        <div className="min-w-0 flex-1">
          <h2 id="v360-chat-title" className="truncate text-base font-bold">
            {s.title}
          </h2>
          <p className="truncate text-sm text-brand-100">{s.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={s.close}
          className="rounded-full p-2 text-white hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>

      {/* Conversación */}
      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <BotBubble>{s.greeting}</BotBubble>
        {answered.map((item) => (
          <div key={item.id} className="space-y-3">
            <BotBubble>{questionText(s, state, item.id)}</BotBubble>
            <UserBubble label={s.you}>{answerLabel(s, state, item)}</UserBubble>
            {item.id === "q:kwh" && savings.level !== "sin_datos" && <BotBubble>{s.savingsMessage(savings)}</BotBubble>}
          </div>
        ))}
        {step && !done && <BotBubble>{questionText(s, state, step.id)}</BotBubble>}

        {done && (
          <div role="status" className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
            <CircleCheck className="mx-auto h-10 w-10 text-wa-600" aria-hidden="true" />
            <p className="mt-2 font-bold text-slate-900">{s.successTitle(state.name)}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{s.successText(state.preferredContact)}</p>
            {whatsappUrl && (
              <a
                ref={focusRef}
                href={whatsappUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-wa-600 px-5 py-3 font-semibold text-white hover:bg-wa-700"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {s.continueWhatsapp}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Respuesta */}
      <div className="relative shrink-0 overflow-hidden border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {step?.kind === "choice" && !done && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={questionText(s, state, step.id)}>
            {step.options.map((value, i) => (
              <button
                key={value}
                ref={i === 0 ? focusRef : undefined}
                type="button"
                onClick={() => choose(value)}
                className="rounded-full border-2 border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-800 transition-colors hover:border-brand-600 hover:bg-brand-50"
              >
                {optionLabel(s, state, step.id, value)}
              </button>
            ))}
          </div>
        )}

        {(step?.kind === "input" || step?.kind === "number") && !done && (() => {
          const field = inputFor(s, step, state);
          return (
            <form noValidate onSubmit={submitInput}>
              <label htmlFor="v360-chat-input" className="sr-only">
                {field.label}
              </label>
              <div className="flex gap-2">
                <input
                  key={step.id}
                  ref={focusRef}
                  id="v360-chat-input"
                  type={field.type}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  autoCapitalize={field.autoCapitalize}
                  maxLength={field.maxLength}
                  value={draft}
                  placeholder={field.placeholder}
                  onChange={(e) => {
                    setDraft(field.format(e.target.value));
                    if (inputError) setInputError("");
                  }}
                  aria-invalid={Boolean(inputError)}
                  aria-describedby={inputError ? "v360-chat-error" : undefined}
                  className={`block min-w-0 flex-1 rounded-full border bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:outline-none ${
                    inputError ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-brand-600 focus:ring-brand-100"
                  }`}
                />
                <button
                  type="submit"
                  aria-label={s.send}
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-700 px-4 text-white hover:bg-brand-800"
                >
                  <Send className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {inputError && (
                <p id="v360-chat-error" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {inputError}
                </p>
              )}
              {step.kind === "number" && (
                <button
                  type="button"
                  onClick={() => choose(SKIP)}
                  className="mt-2 rounded-full border-2 border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-800 transition-colors hover:border-brand-600 hover:bg-brand-50"
                >
                  {s.skipNumber}
                </button>
              )}
            </form>
          );
        })()}

        {step?.kind === "consent" && !done && (
          <form noValidate onSubmit={sendRequest} className="space-y-3">
            <label className="flex items-start gap-3 text-sm leading-5 text-slate-700">
              <input
                ref={focusRef}
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setConsentError(false);
                }}
                aria-invalid={consentError}
                aria-describedby={consentError ? "v360-consent-error" : undefined}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700"
              />
              <span>{s.consentText(state.preferredContact)}</span>
            </label>
            {consentError && (
              <p id="v360-consent-error" className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                {s.consentRequired}
              </p>
            )}
            <p className="text-xs leading-5 text-slate-500">
              {s.privacy} {s.independent}
            </p>

            {/* Campo trampa anti-spam: oculto para personas */}
            <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
              <label htmlFor="v360-chat-company">Company</label>
              <input id="v360-chat-company" type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>

            <div aria-live="polite">
              {(status === "rejected" || status === "offline") && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-semibold">{status === "offline" ? s.offlineTitle : s.rejectedTitle}</p>
                  <p className="mt-1">{s.failedText}</p>
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-2 font-semibold text-wa-700 underline underline-offset-4">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      {s.sendByWhatsapp}
                    </a>
                  )}
                </div>
              )}
              {status === "unverified" && (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">{s.unverifiedTitle}</p>
                  <p className="mt-1">{s.unverifiedText}</p>
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-wa-600 px-4 py-2.5 font-semibold text-white hover:bg-wa-700"
                    >
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                      {s.sendByWhatsapp}
                    </a>
                  )}
                </div>
              )}
            </div>

            {status !== "unverified" && (
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-wa-600 px-5 py-3 text-base font-semibold text-white hover:bg-wa-700 disabled:cursor-wait disabled:opacity-70"
              >
                {status === "submitting" ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    {s.sending}
                  </>
                ) : status === "rejected" || status === "offline" ? (
                  <>
                    <RotateCw className="h-5 w-5" aria-hidden="true" />
                    {s.retry}
                  </>
                ) : (
                  s.submit
                )}
              </button>
            )}
          </form>
        )}

        {/* Controles */}
        <div className="mt-3 flex items-center justify-between text-sm">
          {state.history.length > 0 && !locked ? (
            <button type="button" onClick={goBack} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-brand-700">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {s.back}
            </button>
          ) : (
            <span />
          )}
          {(state.history.length > 0 || done) && status !== "submitting" && (
            <button type="button" onClick={restart} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-brand-700">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {s.restart}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
