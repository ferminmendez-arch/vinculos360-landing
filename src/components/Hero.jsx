import { ArrowRight, CircleCheck, MessageCircle } from "lucide-react";
import { useStrings } from "../i18n.js";
import { WhatsAppLink } from "./ui.jsx";

export default function Hero() {
  const t = useStrings();
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
            {t.hero.badge}
          </p>

          <h1
            id="hero-title"
            className="mt-5 max-w-xl text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-6xl"
          >
            {t.hero.titleStart} <span className="text-brand-700">{t.hero.titleHighlight}</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-pretty text-slate-600">{t.hero.text}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#servicios"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-brand-700/25 transition-colors hover:bg-brand-800"
            >
              {t.hero.primary}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
            <WhatsAppLink variant="outline" className="px-7 py-4 text-base">
              {t.hero.whatsapp}
            </WhatsAppLink>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {t.benefits.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 sm:text-[0.95rem]">
                <CircleCheck className="h-5 w-5 shrink-0 text-wa-600" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl pt-6 pb-16 sm:px-6 sm:pb-10 lg:max-w-none lg:pr-0">
          {/* Fondo decorativo */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 bottom-4 left-10 rounded-[2.5rem] bg-gradient-to-br from-brand-600 to-brand-900 sm:left-16" />
            <div className="absolute -top-2 right-6 h-24 w-24 rounded-full bg-accent-500 opacity-90 blur-[1px] sm:h-28 sm:w-28" />
            <div className="absolute bottom-0 left-0 h-28 w-40 bg-[radial-gradient(var(--color-brand-300)_1.5px,transparent_1.5px)] [background-size:14px_14px] opacity-70" />
          </div>

          <img
            src="/img/ilustraciones/hero-familia.svg"
            alt={t.hero.imageAlt}
            width="600"
            height="528"
            fetchPriority="high"
            decoding="async"
            className="relative aspect-[600/528] w-full rounded-[2rem] bg-brand-900 object-cover shadow-2xl shadow-brand-950/30 ring-4 ring-white sm:mt-6 sm:w-[94%]"
          />

          {/* Tarjeta: conversación por WhatsApp */}
          <div
            aria-hidden="true"
            className="animate-float-soft absolute bottom-0 left-2 flex max-w-[16.5rem] items-start gap-3 rounded-2xl border border-white/60 bg-white/90 p-3 shadow-xl shadow-brand-950/15 backdrop-blur sm:-left-2 sm:bottom-2 sm:max-w-[17rem] sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wa-600 text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                Vínculos 360
                <span className="h-1.5 w-1.5 rounded-full bg-wa-500" />
                <span className="font-medium text-slate-500">{t.hero.chatStatus}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug text-slate-700">{t.hero.chatMessage}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
