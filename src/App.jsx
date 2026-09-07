import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  PhoneCall,
  Star,
} from "lucide-react";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const WHATSAPP_NUMBER = "12818257327";

const GOOGLE_SHEETS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzZUfbdvaZ22Hark9E-mcDxPLifgwZaWYvVcRBuxXG6D2MgWnpMAzPYHp6Y5QFKySRT/exec";

const LOGO_SRC = "/logo-vinculos360.png";
const FAMILY_IMAGE_SRC = "/familia-factura.png";

/* =========================================================
   CONTENIDO
========================================================= */

const MINI_BENEFITS = [
  "Atención personalizada",
  "Orientación sin compromiso",
  "Proceso rápido y sencillo",
];

const STEPS = [
  {
    number: "01",
    title: "Cuéntanos qué necesitas",
    description:
      "Selecciona el servicio que deseas revisar y comparte tus datos básicos.",
  },
  {
    number: "02",
    title: "Revisamos tus opciones",
    description:
      "Analizamos alternativas disponibles de acuerdo con tus necesidades.",
  },
  {
    number: "03",
    title: "Te guiamos paso a paso",
    description:
      "Te explicamos las opciones de forma clara para que puedas comparar.",
  },
  {
    number: "04",
    title: "Elige la mejor opción para ti",
    description:
      "Tú decides qué servicio se adapta mejor a las necesidades de tu hogar.",
  },
];

const TESTIMONIALS = [
  {
    name: "María G.",
    role: "Houston, TX",
    text:
      "Me ayudaron a entender mejor mis opciones y el proceso fue mucho más sencillo de lo que esperaba.",
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
      "Me encantó que todo se explicó de forma sencilla y pude comparar opciones con más confianza.",
    stars: 5,
  },
];

/* =========================================================
   TRACKING
========================================================= */

function getTrackingData() {
  const params = new URLSearchParams(window.location.search);

  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  const utmContent = params.get("utm_content");
  const fbclid = params.get("fbclid");

  let source = utmSource || "";

  if (!source && document.referrer) {
    try {
      source = new URL(document.referrer).hostname;
    } catch {
      source = "";
    }
  }

  if (!source) {
    source = "Direct";
  }

  const width = window.innerWidth;

  let device = "Desktop";

  if (width < 768) {
    device = "Mobile";
  } else if (width < 1024) {
    device = "Tablet";
  }

  return {
    source,
    medium: utmMedium || "",
    campaign: utmCampaign || "",
    ad: utmContent || "",
    fbclid: fbclid || "",
    device,
  };
}

/* =========================================================
   WHATSAPP
========================================================= */

function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function openWhatsApp(message) {
  window.open(
    buildWhatsAppUrl(message),
    "_blank",
    "noopener,noreferrer"
  );
}

function buildLeadWhatsAppMessage(name, service, zipCode) {
  return [
    "Hola, vi Vínculos 360.",
    "",
    `Mi nombre es: ${name}`,
    `Estoy interesado en: ${service}`,
    `ZIP Code: ${zipCode}`,
    "",
    "Quisiera información sobre opciones disponibles para mi hogar.",
  ].join("\n");
}

/* =========================================================
   GOOGLE SHEETS
========================================================= */

async function saveLead(leadData) {
  await fetch(GOOGLE_SHEETS_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(leadData),
  });
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function LandingVinculos360() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    zipCode: "",
  });

  const getInitialService = () => {
  const params = new URLSearchParams(window.location.search);
  const service = params.get("service");

  if (!service) return "";

  const normalized = service.toLowerCase();

  if (normalized === "electricidad") return "Electricidad";
  if (normalized === "internet") return "Internet";
  if (normalized === "otros") return "Otros servicios";

  return "";
};

const [selectedService, setSelectedService] = useState(getInitialService);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  /* =======================================================
     SELECCIONAR SERVICIO
  ======================================================= */

  const selectService = (service) => {
    setSelectedService(service);
    setFormError("");

    setTimeout(() => {
      document
        .getElementById("contacto")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  };

  /* =======================================================
     ENVIAR FORMULARIO
  ======================================================= */

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    setFormError("");

    if (!selectedService) {
      setFormError(
        "Por favor selecciona primero el servicio que deseas revisar."
      );
      return;
    }

    if (!form.name.trim()) {
      setFormError("Por favor ingresa tu nombre.");
      return;
    }

    if (!form.phone.trim()) {
      setFormError("Por favor ingresa tu teléfono.");
      return;
    }

    if (!form.zipCode.trim()) {
      setFormError("Por favor ingresa tu ZIP Code.");
      return;
    }

    if (!/^\d{5}$/.test(form.zipCode.trim())) {
      setFormError("Por favor ingresa un ZIP Code válido de 5 dígitos.");
      return;
    }

    try {
      setIsSubmitting(true);

      const tracking = getTrackingData();

      const leadData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        zipCode: form.zipCode.trim(),
        service: selectedService,

        source: tracking.source,
        medium: tracking.medium,
        campaign: tracking.campaign,
        ad: tracking.ad,
        fbclid: tracking.fbclid,
        device: tracking.device,
      };

      /*
        PASO 1
        Guardar primero el lead en Google Sheets
      */

      await saveLead(leadData);

      /*
        PASO 2
        Preparar mensaje de WhatsApp
      */

      const whatsappMessage = buildLeadWhatsAppMessage(
        form.name.trim(),
        selectedService,
        form.zipCode.trim()
      );

      /*
        PASO 3
        Abrir WhatsApp
      */

      window.location.href = buildWhatsAppUrl(whatsappMessage);
    } catch (error) {
      console.error("Error saving lead:", error);

      setFormError(
        "No pudimos procesar tu información. Por favor intenta nuevamente."
      );

      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">

          <a href="#inicio" className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200 sm:h-14 sm:w-14">
              <img
                src={LOGO_SRC}
                alt="Vínculos 360"
                className="h-full w-full object-contain p-0.5"
              />
            </div>

            <div>
              <p className="text-lg font-extrabold tracking-tight text-slate-900">
                Vínculos{" "}
                <span className="text-sky-600">
                  360
                </span>
              </p>

              <p className="text-xs text-slate-500">
                Conectamos lo que te importa
              </p>
            </div>

          </a>

          <nav className="hidden items-center gap-8 md:flex">

            <a
              href="#inicio"
              className="text-sm font-medium text-slate-700 transition hover:text-sky-600"
            >
              Inicio
            </a>

            <a
              href="#servicios"
              className="text-sm font-medium text-slate-700 transition hover:text-sky-600"
            >
              Servicios
            </a>

            <a
              href="#como-funciona"
              className="text-sm font-medium text-slate-700 transition hover:text-sky-600"
            >
              Cómo Funciona
            </a>

            <a
              href="#testimonios"
              className="text-sm font-medium text-slate-700 transition hover:text-sky-600"
            >
              Testimonios
            </a>

            <a
              href="#contacto"
              className="text-sm font-medium text-slate-700 transition hover:text-sky-600"
            >
              Contacto
            </a>

          </nav>

          <button
            type="button"
            onClick={() =>
              openWhatsApp(
                "Hola, vi Vínculos 360 y quisiera información sobre servicios para mi hogar."
              )
            }
            className="inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-green-600 sm:px-6"
          >
            <MessageCircle className="h-4 w-4" />

            <span className="hidden sm:inline">
              WhatsApp
            </span>
          </button>

        </div>
      </header>

      <main>

        {/* =====================================================
            HERO
        ====================================================== */}

        <section
          id="inicio"
          className="relative overflow-hidden bg-gradient-to-b from-white via-sky-50/40 to-white"
        >

          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.10),_transparent_30%)]" />

          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">

            <div>

              <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Los servicios esenciales de tu hogar, en un solo lugar
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                Te ayudamos a comparar opciones de electricidad,
                internet y otros servicios esenciales para encontrar
                lo que mejor se adapte a las necesidades de tu hogar.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">

                <a
                  href="#servicios"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 hover:shadow-xl"
                >
                  Ver mis opciones

                  <ArrowRight className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={() =>
                    openWhatsApp(
                      "Hola, vi Vínculos 360 y quisiera información sobre servicios para mi hogar."
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 transition hover:border-green-400 hover:text-green-600"
                >
                  <MessageCircle className="h-4 w-4" />

                  WhatsApp
                </button>

              </div>

              <div className="mt-8 space-y-4">

                {MINI_BENEFITS.map((item) => (

                  <div
                    key={item}
                    className="flex items-center gap-3 text-base font-medium text-slate-700"
                  >

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
                  alt="Familia revisando servicios para su hogar"
                  className="h-full w-full object-cover"
                />

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            SERVICIOS
        ====================================================== */}

        <section
          id="servicios"
          className="bg-white py-14 sm:py-16"
        >

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="mx-auto max-w-2xl text-center">

              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Servicios
              </span>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                ¿Qué servicio necesitas?
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-600">
                Selecciona el servicio que deseas revisar.
              </p>

            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">

              {/* ELECTRICIDAD */}

              <button
                type="button"
                onClick={() => selectService("Electricidad")}
                className={`group rounded-[1.75rem] border bg-white p-7 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  selectedService === "Electricidad"
                    ? "border-orange-400 shadow-lg ring-2 ring-orange-100"
                    : "border-slate-200 shadow-sm hover:border-orange-300"
                }`}
              >

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-3xl">
                  ⚡
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  Electricidad
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Revisa opciones de electricidad disponibles para tu
                  hogar y conoce alternativas que se adapten a tus
                  necesidades.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-600">

                  {selectedService === "Electricidad"
                    ? "Seleccionado"
                    : "Seleccionar"}

                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />

                </div>

              </button>

              {/* INTERNET */}

              <button
                type="button"
                onClick={() => selectService("Internet")}
                className={`group rounded-[1.75rem] border bg-white p-7 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  selectedService === "Internet"
                    ? "border-sky-400 shadow-lg ring-2 ring-sky-100"
                    : "border-slate-200 shadow-sm hover:border-sky-300"
                }`}
              >

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-3xl">
                  📶
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  Internet
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Encuentra opciones de conexión para tu hogar según
                  disponibilidad, velocidad y necesidades de uso.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-600">

                  {selectedService === "Internet"
                    ? "Seleccionado"
                    : "Seleccionar"}

                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />

                </div>

              </button>

              {/* OTROS */}

              <button
                type="button"
                onClick={() => selectService("Otros servicios")}
                className={`group rounded-[1.75rem] border bg-white p-7 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  selectedService === "Otros servicios"
                    ? "border-green-400 shadow-lg ring-2 ring-green-100"
                    : "border-slate-200 shadow-sm hover:border-green-300"
                }`}
              >

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl">
                  ➕
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  Otros servicios
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  También podemos orientarte sobre telefonía,
                  seguridad y otros servicios esenciales para tu hogar.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-green-600">

                  {selectedService === "Otros servicios"
                    ? "Seleccionado"
                    : "Seleccionar"}

                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />

                </div>

              </button>

            </div>

          </div>

        </section>

        {/* =====================================================
            CÓMO FUNCIONA
        ====================================================== */}

        <section
          id="como-funciona"
          className="bg-slate-50 py-16 sm:py-20"
        >

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="mx-auto max-w-2xl text-center">

              <span className="inline-flex items-center rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
                Cómo funciona
              </span>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Un proceso simple, claro y sin complicaciones
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-600">
                Te guiamos paso a paso para que puedas conocer tus
                opciones y tomar una decisión con confianza.
              </p>

            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">

              {STEPS.map((step) => (

                <div
                  key={step.number}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-sky-200">
                    {step.number}
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-slate-900">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {step.description}
                  </p>

                </div>

              ))}

            </div>

          </div>

        </section>

        {/* =====================================================
            TESTIMONIOS
        ====================================================== */}

        <section
          id="testimonios"
          className="bg-white py-16 sm:py-20"
        >

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="rounded-[2rem] bg-slate-950 px-6 py-10 text-center sm:px-10">

              <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                Testimonios
              </span>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Una atención clara y personalizada
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Experiencias de personas que buscaban entender mejor
                sus opciones de servicios para el hogar.
              </p>

              <div className="mt-10 grid gap-6 lg:grid-cols-3">

                {TESTIMONIALS.map((testimonial) => (

                  <figure
                    key={testimonial.name}
                    className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left"
                  >

                    <div className="flex gap-1 text-amber-400">

                      {Array.from({
                        length: testimonial.stars,
                      }).map((_, index) => (

                        <Star
                          key={index}
                          className="h-4 w-4 fill-current"
                        />

                      ))}

                    </div>

                    <blockquote className="mt-5 text-sm leading-7 text-slate-200">
                      “{testimonial.text}”
                    </blockquote>

                    <figcaption className="mt-6 border-t border-white/10 pt-4">

                      <p className="font-bold text-white">
                        {testimonial.name}
                      </p>

                      <p className="text-sm text-slate-400">
                        {testimonial.role}
                      </p>

                    </figcaption>

                  </figure>

                ))}

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            CONTACTO / LEAD CAPTURE
        ====================================================== */}

        <section
          id="contacto"
          className="bg-slate-950 py-16 sm:py-20"
        >

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">

              {/* IZQUIERDA */}

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">

                <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                  Contacto
                </span>

                <h2 className="mt-4 max-w-xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Cuéntanos qué servicio necesitas
                </h2>

                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Completa tus datos y continuaremos la conversación
                  por WhatsApp.
                </p>

                {selectedService ? (

                  <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-4 text-white">

                    <CheckCircle2 className="h-5 w-5 text-green-400" />

                    <div>

                      <p className="text-xs text-slate-400">
                        Servicio seleccionado
                      </p>

                      <p className="font-bold">
                        {selectedService}
                      </p>

                    </div>

                  </div>

                ) : (

                  <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
                    Selecciona primero Electricidad, Internet u Otro
                    servicio.
                  </div>

                )}

                <div className="mt-8">

                  <a
                    href="tel:+12818257327"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
                  >
                    <PhoneCall className="h-4 w-4" />

                    (281) 825-7327
                  </a>

                </div>

              </div>

              {/* FORMULARIO */}

              <div className="rounded-[2rem] bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">

                <form
                  className="space-y-5"
                  onSubmit={handleFormSubmit}
                >

                  <div>

                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Nombre
                    </label>

                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Tu nombre"
                      value={form.name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          name: e.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Teléfono
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(281) 555-1234"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phone: e.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="zipCode"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      ZIP Code
                    </label>

                    <input
                      id="zipCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={5}
                      placeholder="77494"
                      value={form.zipCode}
                      onChange={(e) => {

                        const value =
                          e.target.value.replace(/\D/g, "");

                        setForm({
                          ...form,
                          zipCode: value,
                        });

                      }}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />

                  </div>

                  {selectedService && (

                    <div className="rounded-2xl bg-sky-50 px-4 py-3">

                      <p className="text-xs font-medium text-slate-500">
                        Servicio seleccionado
                      </p>

                      <p className="mt-1 font-bold text-sky-700">
                        {selectedService}
                      </p>

                    </div>

                  )}

                  {formError && (

                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {formError}
                    </div>

                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {isSubmitting
                      ? "Procesando..."
                      : "Continuar por WhatsApp"}

                    {!isSubmitting && (
                      <MessageCircle className="h-5 w-5" />
                    )}

                  </button>

                  <p className="text-center text-xs leading-5 text-slate-500">
                    Al continuar, utilizaremos esta información para
                    atender tu solicitud y continuar la conversación
                    contigo.
                  </p>

                </form>

              </div>

            </div>

          </div>

        </section>

      </main>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-sm text-slate-400">
        © 2026 Vínculos 360. Todos los derechos reservados.
      </footer>

    </div>
  );
}