import { ArrowRight, CircleCheck, Plus, Wifi, Zap } from "lucide-react";
import { SERVICES } from "../content.js";
import { SectionHeading } from "./ui.jsx";

const ICONS = { Electricidad: Zap, Internet: Wifi, "Otros servicios": Plus };

const TONES = {
  orange: {
    icon: "bg-accent-100 text-accent-700",
    selected: "border-accent-500 ring-4 ring-accent-100",
    hover: "hover:border-accent-400",
    cta: "text-accent-700",
  },
  blue: {
    icon: "bg-brand-100 text-brand-700",
    selected: "border-brand-600 ring-4 ring-brand-100",
    hover: "hover:border-brand-400",
    cta: "text-brand-700",
  },
  green: {
    icon: "bg-wa-100 text-wa-700",
    selected: "border-wa-600 ring-4 ring-wa-100",
    hover: "hover:border-wa-600",
    cta: "text-wa-700",
  },
};

export default function Services({ selectedService, onSelect }) {
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="servicios-title"
          eyebrow="Servicios"
          title="¿Qué servicio necesitas?"
          description="Selecciona el servicio que deseas revisar y te llevamos directo al formulario."
        />

        <ul className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.value];
            const tone = TONES[service.tone];
            const isSelected = selectedService === service.value;
            return (
              <li key={service.value} className="flex">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(service.value, { scroll: true })}
                  className={`group flex w-full flex-col rounded-3xl border-2 bg-white p-6 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-7 ${
                    isSelected ? `${tone.selected} shadow-lg` : `border-slate-200 ${tone.hover}`
                  }`}
                >
                  <span className="flex items-start justify-between">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone.icon}`}>
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>
                    {isSelected && <CircleCheck className="h-7 w-7 text-wa-600" aria-hidden="true" />}
                  </span>
                  <span className="mt-5 block text-xl font-bold text-slate-900">{service.title}</span>
                  <span className="mt-2 block flex-1 text-[0.95rem] leading-7 text-slate-600">{service.description}</span>
                  <span className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${tone.cta}`}>
                    {isSelected ? "Seleccionado — continuar" : "Seleccionar"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
