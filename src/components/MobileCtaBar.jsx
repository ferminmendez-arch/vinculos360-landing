import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { PHONE_E164 } from "../config.js";

/* Barra fija en móviles. Se oculta mientras el formulario está en pantalla
   para no tapar el botón de envío. */
export default function MobileCtaBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById("contacto");
    if (!target || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-transform duration-200 md:hidden ${
        hidden ? "pointer-events-none translate-y-full" : "translate-y-0"
      }`}
      aria-hidden={hidden}
    >
      <div className="flex gap-3">
        <a
          href={`tel:${PHONE_E164}`}
          tabIndex={hidden ? -1 : undefined}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-3 text-base font-semibold text-slate-800"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          Llamar
        </a>
        <a
          href="#contacto"
          tabIndex={hidden ? -1 : undefined}
          className="inline-flex flex-[1.4] items-center justify-center rounded-full bg-brand-700 px-4 py-3 text-base font-semibold text-white"
        >
          Solicitar ayuda
        </a>
      </div>
    </div>
  );
}
