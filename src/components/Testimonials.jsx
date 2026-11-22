import { Star } from "lucide-react";
import { TESTIMONIALS } from "../content.js";
import { SectionHeading } from "./ui.jsx";

export default function Testimonials() {
  return (
    <section id="testimonios" aria-labelledby="testimonios-title" className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-brand-950 px-5 py-12 sm:px-10 lg:px-14">
          <SectionHeading
            id="testimonios-title"
            tone="dark"
            eyebrow="Testimonios"
            title="Una atención clara y personalizada"
            description="Experiencias de personas que buscaban entender mejor sus opciones de servicios para el hogar."
          />

          <ul className="mt-10 grid gap-5 lg:grid-cols-3 lg:gap-6">
            {TESTIMONIALS.map((t) => (
              <li key={t.name}>
                <figure className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                  <div className="flex gap-1 text-amber-400" role="img" aria-label={`${t.stars} de 5 estrellas`}>
                    {Array.from({ length: t.stars }, (_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="mt-5 flex-1 text-base leading-7 text-slate-100">
                    <p>“{t.text}”</p>
                  </blockquote>
                  <figcaption className="mt-6 border-t border-white/10 pt-4">
                    <span className="block font-bold text-white">{t.name}</span>
                    <span className="block text-sm text-slate-300">{t.location}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
