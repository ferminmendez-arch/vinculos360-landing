import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CalendarClock, Calculator, Info, MapPin, RotateCcw, Share2, ShieldCheck } from "lucide-react";
import { useLang } from "../i18n.js";
import { ANALYZER_STRINGS, SOURCE_URLS, fmtCents } from "../lib/analyzerStrings.js";
import { TX_RESIDENTIAL_AVG, analyzeBill, shareUrl, validateAnalyzerInput } from "../lib/billAnalyzer.js";
import { trackChatEvent } from "../lib/chatbot/api.js";
import ReminderSignup from "./ReminderSignup.jsx";
import { SectionHeading } from "./ui.jsx";

const LEVEL_TONES = {
  alta: "border-accent-500 bg-accent-50 text-accent-700",
  media: "border-brand-300 bg-brand-50 text-brand-900",
  baja: "border-wa-600 bg-wa-50 text-wa-700",
};

const EMPTY = { bill: "", kwh: "", zipCode: "", contractEnd: "" };

/* Abre el chat con los datos del analizador ya contestados (lo escucha Chatbot.jsx). */
function openComparisonChat(values) {
  window.dispatchEvent(new CustomEvent("v360:open-chat", { detail: { analyzer: values } }));
}

function Field({ id, label, help, error, optionalLabel, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-slate-500">({optionalLabel})</span>}
      </label>
      {children}
      <p id={`${id}-help`} className="mt-1 text-xs leading-5 text-slate-500">
        {help}
      </p>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export default function BillAnalyzer() {
  const lang = useLang();
  const s = ANALYZER_STRINGS[lang] || ANALYZER_STRINGS.es;
  const uid = useId();
  const ids = { bill: `${uid}-bill`, kwh: `${uid}-kwh`, zipCode: `${uid}-zip`, contractEnd: `${uid}-end` };
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [values, setValues] = useState(null);
  const sectionRef = useRef(null);
  const resultRef = useRef(null);
  const viewed = useRef(false);

  // Métrica anónima: la sección se vio al menos una vez en esta visita.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!viewed.current && entries.some((e) => e.isIntersecting)) {
          viewed.current = true;
          trackChatEvent("analyzer_view", { language: lang, serviceKey: "electricidad" });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lang]);

  // Al mostrar el resultado, el foco va a él (lectores de pantalla y teclado).
  useEffect(() => {
    if (result) resultRef.current?.focus({ preventScroll: false });
  }, [result]);

  const started = useRef(false);
  const update = (field) => (event) => {
    if (!started.current && event.target.value) {
      started.current = true;
      trackChatEvent("analyzer_started", { language: lang, serviceKey: "electricidad" });
    }
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const calculate = (event) => {
    event.preventDefault();
    const checked = validateAnalyzerInput(form);
    if (checked.errors) {
      setErrors(checked.errors);
      setResult(null);
      const first = ["bill", "kwh", "zipCode", "contractEnd"].find((f) => checked.errors[f]);
      document.getElementById(ids[first])?.focus();
      return;
    }
    setErrors({});
    setValues(checked.values);
    setResult(analyzeBill(checked.values));
    trackChatEvent("analyzer_calc", { language: lang, serviceKey: "electricidad" });
  };

  const requestComparison = () => {
    trackChatEvent("analyzer_cta", { language: lang, serviceKey: "electricidad" });
    openComparisonChat(values);
  };

  const [copied, setCopied] = useState(false);
  const share = async () => {
    trackChatEvent("analyzer_share", { language: lang, serviceKey: "electricidad" });
    const url = shareUrl(lang);
    try {
      if (navigator.share) {
        await navigator.share({ title: s.share.title, text: s.share.text, url });
        return;
      }
      await navigator.clipboard.writeText(`${s.share.text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      /* el visitante canceló o el navegador no lo permite: no pasa nada */
    }
  };
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(`${s.share.text} ${shareUrl(lang)}`)}`;

  const reset = () => {
    setResult(null);
    setValues(null);
    setForm(EMPTY);
    window.requestAnimationFrame(() => document.getElementById(ids.bill)?.focus());
  };

  const describedBy = (field) => [`${ids[field]}-help`, errors[field] ? `${ids[field]}-error` : ""].filter(Boolean).join(" ");
  const inputClass = (field) =>
    `mt-1.5 block min-h-12 w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none ${
      errors[field] ? "border-red-500" : "border-slate-300"
    }`;
  const hasErrors = Object.values(errors).some(Boolean);
  const level = result?.comparison.level;
  // Fuera de Texas el promedio de Texas no aplica: solo se muestra el costo y el aviso.
  const levelCopy = level && level !== "sin_datos" && result.zone !== "fuera_de_texas" ? s.levels[level](result.comparison) : null;
  const canCompare = result && result.zone !== "fuera_de_texas";

  return (
    <section
      id="analizador"
      ref={sectionRef}
      aria-labelledby="analizador-title"
      className="scroll-mt-20 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="analizador-title" eyebrow={s.eyebrow} title={s.title} description={s.text} />

        <div className="mt-10 grid gap-6 lg:grid-cols-5 lg:gap-8">
          <form
            onSubmit={calculate}
            noValidate
            aria-label={s.formLabel}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-7 lg:col-span-3"
          >
            {hasErrors && (
              <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {s.errorSummary}
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={ids.bill} label={s.bill} help={s.billHelp} error={s.errors[errors.bill]}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-slate-500" aria-hidden="true">
                    $
                  </span>
                  <input
                    id={ids.bill}
                    name="bill"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors.bill)}
                    aria-describedby={describedBy("bill")}
                    value={form.bill}
                    onChange={update("bill")}
                    placeholder="145.80"
                    className={`${inputClass("bill")} pl-8`}
                  />
                </div>
              </Field>
              <Field id={ids.kwh} label={s.kwh} help={s.kwhHelp} error={s.errors[errors.kwh]}>
                <input
                  id={ids.kwh}
                  name="kwh"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.kwh)}
                  aria-describedby={describedBy("kwh")}
                  value={form.kwh}
                  onChange={update("kwh")}
                  placeholder="1000"
                  className={inputClass("kwh")}
                />
              </Field>
              <Field id={ids.zipCode} label={s.zip} help={s.zipHelp} error={s.errors[errors.zipCode]}>
                <input
                  id={ids.zipCode}
                  name="zipCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={10}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.zipCode)}
                  aria-describedby={describedBy("zipCode")}
                  value={form.zipCode}
                  onChange={update("zipCode")}
                  placeholder="77036"
                  className={inputClass("zipCode")}
                />
              </Field>
              <Field
                id={ids.contractEnd}
                label={s.contractEnd}
                optionalLabel={s.optional}
                help={s.contractHelp}
                error={s.errors[errors.contractEnd]}
              >
                <input
                  id={ids.contractEnd}
                  name="contractEnd"
                  type="date"
                  aria-invalid={Boolean(errors.contractEnd)}
                  aria-describedby={describedBy("contractEnd")}
                  value={form.contractEnd}
                  onChange={update("contractEnd")}
                  className={inputClass("contractEnd")}
                />
              </Field>
            </div>
            <button
              type="submit"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white shadow-md shadow-brand-900/20 transition hover:bg-brand-800 focus-visible:ring-4 focus-visible:ring-brand-200 sm:w-auto"
            >
              <Calculator className="h-5 w-5" aria-hidden="true" />
              {s.submit}
            </button>
          </form>

          <div className="lg:col-span-2" aria-live="polite">
            {!result ? (
              <aside className="h-full rounded-3xl border border-dashed border-slate-300 p-5 sm:p-7">
                <h3 className="flex items-center gap-2 font-bold text-slate-900">
                  <Info className="h-5 w-5 text-brand-700" aria-hidden="true" />
                  {s.tipsTitle}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {s.tips.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : (
              <div
                ref={resultRef}
                tabIndex={-1}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 outline-none sm:p-7"
              >
                <h3 className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">{s.resultTitle}</h3>
                <p className="mt-3 text-slate-700">{s.resultLabel}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-900">{fmtCents(result.cents, lang)}</span>
                  <span className="text-slate-600">{s.perKwh}</span>
                </p>
                {result.zone !== "fuera_de_texas" && <p className="mt-2 text-sm text-slate-600">{s.average(TX_RESIDENTIAL_AVG)}</p>}

                {levelCopy && (
                  <div className={`mt-4 rounded-2xl border-l-4 p-4 ${LEVEL_TONES[level]}`}>
                    <p className="font-bold">{levelCopy.title}</p>
                    <p className="mt-1 text-sm leading-6">{levelCopy.text}</p>
                  </div>
                )}

                {result.contract.status !== "sin_dato" && (
                  <p className="mt-4 flex gap-2 text-sm leading-6 text-slate-700">
                    <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                    <span>{s.contract[result.contract.status](result.contract)}</span>
                  </p>
                )}
                {s.zones[result.zone] && (
                  <p className="mt-3 flex gap-2 text-sm leading-6 text-slate-700">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-700" aria-hidden="true" />
                    <span>{s.zones[result.zone]}</span>
                  </p>
                )}

                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{s.disclaimer}</p>

                {canCompare && (
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <p className="font-bold text-slate-900">{s.ctaTitle}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{s.ctaText}</p>
                    <button
                      type="button"
                      onClick={requestComparison}
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-700 px-6 py-3 font-semibold text-white shadow-md transition hover:brightness-90 focus-visible:ring-4 focus-visible:ring-accent-100"
                    >
                      {s.cta}
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <p className="mt-2 flex gap-1.5 text-xs leading-5 text-slate-500">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-wa-600" aria-hidden="true" />
                      <span>{s.ctaNote}</span>
                    </p>
                  </div>
                )}

                {canCompare && <ReminderSignup key={values?.contractEnd || "sin-fecha"} analyzer={values} lang={lang} s={s} />}

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={share}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    {s.share.button}
                  </button>
                  <a
                    href={whatsappShare}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackChatEvent("analyzer_share", { language: lang, serviceKey: "electricidad" })}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-wa-700 underline-offset-4 hover:underline"
                  >
                    {s.share.whatsapp}
                  </a>
                  <span role="status" className="text-sm text-slate-600">
                    {copied ? s.share.copied : ""}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {s.recalc}
                </button>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {s.sources}:{" "}
                  <a href={SOURCE_URLS.eia} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {s.sourceEia}
                  </a>
                  {" · "}
                  <a href={SOURCE_URLS.puct} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {s.sourcePuct}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
