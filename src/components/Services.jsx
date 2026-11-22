import { ArrowRight, Cctv, CircleCheck, Plus, Wifi, Zap } from "lucide-react";
import { SERVICES } from "../content.js";
import { useStrings } from "../i18n.js";
import { SectionHeading } from "./ui.jsx";

const ICONS = { electricidad: Zap, internet: Wifi, seguridad: Cctv, otros: Plus };

const TONES = {
  orange: {
    icon: "bg-accent-500 text-white",
    selected: "border-accent-500 ring-4 ring-accent-100",
    hover: "hover:border-accent-400",
    cta: "text-accent-700",
  },
  blue: {
    icon: "bg-brand-700 text-white",
    selected: "border-brand-600 ring-4 ring-brand-100",
    hover: "hover:border-brand-400",
    cta: "text-brand-700",
  },
  navy: {
    icon: "bg-brand-900 text-white",
    selected: "border-brand-900 ring-4 ring-brand-100",
    hover: "hover:border-brand-500",
    cta: "text-brand-900",
  },
  green: {
    icon: "bg-wa-600 text-white",
    selected: "border-wa-600 ring-4 ring-wa-100",
    hover: "hover:border-wa-600",
    cta: "text-wa-700",
  },
};

export default function Services({ selectedService, onSelect }) {
  const t = useStrings();
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="servicios-title"
          eyebrow={t.services.eyebrow}
          title={t.services.title}
          description={t.services.text}
        />

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.slug];
            const tone = TONES[service.tone];
            const copy = t.services.items[service.slug];
            const isSelected = selectedService === service.value;
            return (
              <li key={service.value} className="flex">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(service.value, { scroll: true })}
                  className={`group flex w-full flex-col overflow-hidden rounded-3xl border-2 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                    isSelected ? `${tone.selected} shadow-lg` : `border-slate-200 ${tone.hover}`
                  }`}
                >
                  <span className="relative block">
                    <img
                      src={service.image}
                      alt=""
                      width="480"
                      height="300"
                      loading="lazy"
                      decoding="async"
                      className="block aspect-[8/5] w-full object-cover"
                    />
                    <span
                      className={`absolute -bottom-6 left-6 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ring-4 ring-white ${tone.icon}`}
                    >
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    {isSelected && (
                      <span className="absolute top-4 right-4 rounded-full bg-white p-1 shadow">
                        <CircleCheck className="h-6 w-6 text-wa-600" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col p-6 pt-9 sm:px-7">
                    <span className="block text-xl font-bold text-slate-900">{copy.title}</span>
                    <span className="mt-2 block flex-1 text-[0.95rem] leading-7 text-slate-600">{copy.description}</span>
                    <span className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${tone.cta}`}>
                      {isSelected ? t.services.selected : t.services.select}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
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
