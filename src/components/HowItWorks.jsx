import { STEP_NUMBERS } from "../content.js";
import { useStrings } from "../i18n.js";
import { SectionHeading } from "./ui.jsx";

export default function HowItWorks() {
  const t = useStrings();
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="como-funciona-title"
          eyebrow={t.steps.eyebrow}
          title={t.steps.title}
          description={t.steps.text}
        />

        <div className="relative mt-12">
          <div
            aria-hidden="true"
            className="absolute top-13 right-[12%] left-[12%] hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-300 to-accent-200 xl:block"
          />
          <ol className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {t.steps.items.map((step, index) => (
              <li key={STEP_NUMBERS[index]} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-lg font-bold text-white shadow-md shadow-brand-700/25">
                  <span className="sr-only">{t.steps.stepLabel}</span>
                  {STEP_NUMBERS[index]}
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-7 text-slate-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
