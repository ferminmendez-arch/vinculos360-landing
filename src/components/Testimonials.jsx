import { Star } from "lucide-react";
import { TESTIMONIAL_PEOPLE } from "../content.js";
import { useStrings } from "../i18n.js";
import { SectionHeading } from "./ui.jsx";

export default function Testimonials() {
  const t = useStrings();
  return (
    <section id="testimonios" aria-labelledby="testimonios-title" className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-brand-950 px-5 py-12 sm:px-10 lg:px-14">
          <SectionHeading
            id="testimonios-title"
            tone="dark"
            eyebrow={t.testimonials.eyebrow}
            title={t.testimonials.title}
            description={t.testimonials.text}
          />

          <ul className="mt-10 grid gap-5 lg:grid-cols-3 lg:gap-6">
            {TESTIMONIAL_PEOPLE.map((person, index) => (
              <li key={person.name}>
                <figure className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                  <div className="flex gap-1 text-amber-400" role="img" aria-label={t.testimonials.stars(person.stars)}>
                    {Array.from({ length: person.stars }, (_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="mt-5 flex-1 text-base leading-7 text-slate-100">
                    <p>“{t.testimonials.quotes[index]}”</p>
                  </blockquote>
                  <figcaption className="mt-6 border-t border-white/10 pt-4">
                    <span className="block font-bold text-white">{person.name}</span>
                    <span className="block text-sm text-slate-300">{person.location}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>

          {t.testimonials.note && (
            <p className="mt-6 text-center text-sm text-slate-300">{t.testimonials.note}</p>
          )}
        </div>
      </div>
    </section>
  );
}
