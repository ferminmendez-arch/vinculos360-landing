import { STEPS } from "../content.js";
import { SectionHeading } from "./ui.jsx";

export default function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="como-funciona-title"
          eyebrow="Cómo funciona"
          title="Un proceso simple, claro y sin complicaciones"
          description="Te guiamos paso a paso para que puedas conocer tus opciones y tomar una decisión con confianza."
        />

        <div className="relative mt-12">
        <div
          aria-hidden="true"
          className="absolute top-13 right-[12%] left-[12%] hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-300 to-accent-200 xl:block"
        />
        <ol className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-lg font-bold text-white shadow-md shadow-brand-700/25">
                <span className="sr-only">Paso </span>
                {step.number}
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
