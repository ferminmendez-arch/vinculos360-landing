// VERSION: 202605181335
// Landing page principal de Vínculos 360

import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  PhoneCall,
  Star,
} from "lucide-react";

const WHATSAPP_NUMBER = "13466385556";
const LOGO_SRC = "/logo-vinculos360.png";
const FAMILY_IMAGE_SRC = "/familia-factura.png";

const STEPS = [
  {
    number: "01",
    title: "Regístrate gratis",
    description:
      "Completa un formulario rápido y cuéntanos qué servicios quieres revisar.",
  },
  {
    number: "02",
    title: "Revisamos tus opciones",
    description:
      "Analizamos alternativas en energía, internet, telefonía y más para ti.",
  },
  {
    number: "03",
    title: "Te guiamos paso a paso",
    description:
      "Te explicamos el proceso de forma clara para que tomes la mejor decisión.",
  },
  {
    number: "04",
    title: "Empieza a ahorrar",
    description:
      "Activa el cambio y comienza a ver resultados en tus servicios esenciales.",
  },
];

const TESTIMONIALS = [
  {
    name: "María G.",
    role: "Houston, TX",
    text:
      "Me ayudaron a entender mis opciones y ahora pago menos en mis servicios sin complicaciones.",
    stars: 5,
  },
  {
    name: "Hector H.",
    role: "Pecos, TX",
    text:
      "El proceso fue rápido, claro y muy profesional. Excelente atención desde el primer mensaje.",
    stars: 5,
  },
  {
    name: "Ana L.",
    role: "Austin, TX",
    text:
      "Me encantó que todo se explicó de forma sencilla. Ahora tengo más control de mis gastos.",
    stars: 5,
  },
];

const MINI_BENEFITS = [
  "Atención en español",
  "Evaluación gratuita",
  "Proceso rápido y sencillo",
];

function buildWhatsAppMessage(name, email, message) {
  const lines = [
    "Hola, quiero una evaluación gratuita.",
    name ? `Nombre: ${name}` : null,
    email ? `Correo: ${email}` : null,
    message ? `Mensaje: ${message}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function openWhatsApp(message) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function LandingVinculos360() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const message = buildWhatsAppMessage(form.name, form.email, form.message);
    openWhatsApp(message);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200 sm:h-14 sm:w-14">
              <img
                src={LOGO_SRC}
                alt="Vínculos 360"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-slate-900">
                Vínculos <span className="text-sky-600">360</span>
              </p>
              <p className="text-xs text-slate-500">Soluciones para ahorrar</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#inicio" className="text-sm font-medium text-slate-700 hover:text-sky-600">
              Inicio
            </a>
            <a
              href="#como-funciona"
              className="text-sm font-medium text-slate-700 hover:text-sky-600"
            >
              Cómo Funciona
            </a>
            <a
              href="#testimonios"
              className="text-sm font-medium text-slate-700 hover:text-sky-600"
            >
              Testimonios
            </a>
            <a href="#contacto" className="text-sm font-medium text-slate-700 hover:text-sky-600">
              Contacto
            </a>
          </nav>

          <button
            type="button"
            onClick={() => openWhatsApp("Hola, quiero una evaluación gratuita.")}
            className="inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-green-600"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
        </div>
      </header>

      <main>
        <section
          id="inicio"
          className="relative overflow-hidden bg-gradient-to-b from-white via-sky-50/40 to-white"
        >
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.10),_transparent_30%)]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">
            <div>
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                Ahorra en energía, internet y servicios esenciales
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                Revisamos tus servicios esenciales como energía, internet, telefonía y televisión por cable para ayudarte a ahorrar más y tomar decisiones inteligentes.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#contacto"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 hover:shadow-xl"
                >
                  Quiero ahorrar ahora
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 space-y-4">
                {MINI_BENEFITS.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-base font-medium text-slate-700">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-4 top-10 h-24 w-24 rounded-full bg-sky-200/40 blur-2xl" />
              <div className="absolute -right-6 bottom-8 h-28 w-28 rounded-full bg-blue-200/40 blur-2xl" />

              <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                <img
                  src={FAMILY_IMAGE_SRC}
                  alt="Familia revisando factura"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="relative overflow-hidden bg-slate-50 py-16 sm:py-20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_40%)]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
                Cómo funciona
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Un proceso simple, claro y sin complicaciones
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Te guiamos paso a paso para que entiendas tus opciones y tomes decisiones con confianza.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-sky-100/70 blur-2xl transition group-hover:bg-sky-200/80" />
                  <div className="relative z-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-sky-200">
                      {step.number}
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-slate-900">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="testimonios" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] bg-slate-950 px-6 py-10 text-center shadow-2xl shadow-slate-900/10 sm:px-10">
              <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                Testimonios
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Personas que ya tomaron acción
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Historias reales de usuarios que buscaban ahorrar y simplificar sus servicios.
              </p>

              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {TESTIMONIALS.map((t) => (
                  <figure
                    key={t.name}
                    className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left backdrop-blur"
                  >
                    <div className="flex gap-1 text-amber-400">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <blockquote className="mt-5 text-sm leading-7 text-slate-200">“{t.text}”</blockquote>
                    <figcaption className="mt-6 border-t border-white/10 pt-4">
                      <p className="font-bold text-white">{t.name}</p>
                      <p className="text-sm text-slate-400">{t.role}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="contacto" className="bg-slate-950 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/10 backdrop-blur">
                <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                  Contacto
                </span>
                <h2 className="mt-4 max-w-xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Empecemos hoy con una evaluación gratuita
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Escríbenos por WhatsApp o completa el formulario para recibir orientación sobre tus servicios.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openWhatsApp("Hola, quiero una evaluación gratuita.")}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-green-600"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Escribir por WhatsApp
                  </button>
                  <a
                    href="tel:+13466385556"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Llamar ahora
                  </a>
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
                    <input
                      type="text"
                      placeholder="Tu nombre"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Correo electrónico</label>
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Mensaje</label>
                    <textarea
                      rows={4}
                      placeholder="Cuéntanos qué servicio deseas revisar"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700"
                  >
                    Enviar consulta
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-sm text-slate-400">
        © 2026 Vínculos 360. Todos los derechos reservados.
      </footer>
    </div>
  );
}
