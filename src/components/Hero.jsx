import { ArrowRight, CircleCheck } from "lucide-react";
import { MINI_BENEFITS } from "../content.js";
import { WhatsAppLink } from "./ui.jsx";

const HERO_SIZES = "(min-width: 1280px) 600px, (min-width: 1024px) 48vw, 100vw";

export default function Hero() {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,var(--color-brand-100),transparent_55%),radial-gradient(ellipse_at_bottom_right,var(--color-accent-50),transparent_50%)]"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 sm:pt-14 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-white/80 px-3 py-1 text-sm font-semibold text-accent-700">
            <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
            Electricidad · Internet · Otros servicios
          </p>

          <h1
            id="hero-title"
            className="mt-5 max-w-xl text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-6xl"
          >
            Los servicios esenciales de tu hogar,{" "}
            <span className="text-brand-700">en un solo lugar</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-pretty text-slate-600">
            Te ayudamos a comparar opciones de electricidad, internet y otros servicios
            esenciales para encontrar lo que mejor se adapte a las necesidades de tu hogar.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#servicios"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-brand-700/25 transition-colors hover:bg-brand-800"
            >
              Ver mis opciones
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
            <WhatsAppLink variant="outline" className="px-7 py-4 text-base">
              Hablar por WhatsApp
            </WhatsAppLink>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {MINI_BENEFITS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 sm:text-[0.95rem]">
                <CircleCheck className="h-5 w-5 shrink-0 text-wa-600" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-3 -z-10 rotate-2 rounded-[2.25rem] bg-gradient-to-br from-brand-600 via-brand-700 to-accent-500 opacity-90 sm:-inset-4"
          />
          <picture>
            <source
              type="image/avif"
              srcSet="/img/familia-640.avif 640w, /img/familia-960.avif 960w, /img/familia-1338.avif 1338w"
              sizes={HERO_SIZES}
            />
            <source
              type="image/webp"
              srcSet="/img/familia-640.webp 640w, /img/familia-960.webp 960w, /img/familia-1338.webp 1338w"
              sizes={HERO_SIZES}
            />
            <img
              src="/img/familia-960.jpg"
              alt="Familia sonriente revisando la factura de luz de su hogar"
              width="1338"
              height="1176"
              fetchPriority="high"
              decoding="async"
              className="aspect-[1338/1176] w-full rounded-[2rem] bg-slate-100 object-cover shadow-2xl shadow-brand-900/20"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
