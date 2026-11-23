import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import Services from "./components/Services.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Testimonials from "./components/Testimonials.jsx";
import ContactSection from "./components/ContactSection.jsx";
import Footer from "./components/Footer.jsx";
import MobileCtaBar from "./components/MobileCtaBar.jsx";
import Chatbot from "./components/Chatbot.jsx";
import { serviceFromQuery } from "./content.js";
import { flushQueue } from "./lib/leads.js";
import { LangContext, STRINGS } from "./i18n.js";

function scrollToContact() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("contacto")?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

export default function App({ lang = "es" }) {
  const [selectedService, setSelectedService] = useState(() => serviceFromQuery(window.location.search));

  // Reintenta solicitudes que no se pudieron guardar en visitas anteriores.
  useEffect(() => {
    flushQueue();
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const selectService = (service, { scroll = false } = {}) => {
    setSelectedService(service);
    if (scroll) window.requestAnimationFrame(scrollToContact);
  };

  return (
    <LangContext value={lang}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-brand-700 focus:px-5 focus:py-3 focus:font-semibold focus:text-white"
      >
        {STRINGS[lang].skip}
      </a>
      <Header />
      <main id="contenido">
        <Hero />
        <Services selectedService={selectedService} onSelect={selectService} />
        <HowItWorks />
        <Testimonials />
        <ContactSection selectedService={selectedService} onSelectService={selectService} />
      </main>
      <Footer />
      <MobileCtaBar />
      <Chatbot />
    </LangContext>
  );
}
