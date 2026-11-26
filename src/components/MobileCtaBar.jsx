import { useEffect, useState } from "react";
import { MessageCircleMore, Phone } from "lucide-react";
import { PHONE_E164 } from "../config.js";
import { useStrings } from "../i18n.js";
import { chatRequestedInUrl, openChat } from "../lib/chatbot/open.js";

/* Barra fija en móviles: llamar o abrir el chat (el único chat del sitio; en celular no hay botón flotante).
   Se oculta mientras el formulario está en pantalla para no tapar el botón de envío. */
export default function MobileCtaBar() {
  const t = useStrings();
  const [hidden, setHidden] = useState(false);
  const [attention, setAttention] = useState(chatRequestedInUrl);

  // Con ?chat=1 (enlace desde WhatsApp) el botón del chat se resalta unos segundos.
  useEffect(() => {
    if (!attention) return undefined;
    const id = window.setTimeout(() => setAttention(false), 6000);
    return () => window.clearTimeout(id);
  }, [attention]);

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
          {t.mobileBar.call}
        </a>
        <button
          type="button"
          onClick={() => openChat()}
          tabIndex={hidden ? -1 : undefined}
          aria-haspopup="dialog"
          aria-controls="v360-chat"
          className={`inline-flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-brand-700 px-4 whitespace-nowrap py-3 text-base font-semibold text-white ${
            attention ? "animate-attention" : ""
          }`}
        >
          <MessageCircleMore className="h-5 w-5" aria-hidden="true" />
          {t.mobileBar.request}
        </button>
      </div>
    </div>
  );
}
