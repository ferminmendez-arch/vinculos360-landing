import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleMore, X } from "lucide-react";
import { useLang } from "../i18n.js";
import { CHAT_STRINGS } from "../lib/chatbot/strings.js";
import { trackChatEvent } from "../lib/chatbot/api.js";

/* El panel se descarga solo cuando alguien abre el chat,
   para no aumentar el peso inicial de la página. */
const ChatPanel = lazy(() => import("./ChatPanel.jsx"));

/* vinculos360.com/?chat=1 (por ejemplo, desde WhatsApp): la página carga normal y, a los
   pocos segundos, aparece una burbuja de invitación junto al botón del chat. El chat solo
   se abre si el visitante la toca. */
const TEASER_DELAY_MS = 2500;

function chatRequestedInUrl() {
  if (typeof window === "undefined") return false;
  return ["1", "abrir", "open"].includes(new URLSearchParams(window.location.search).get("chat"));
}

export default function Chatbot() {
  const lang = useLang();
  const s = CHAT_STRINGS[lang] || CHAT_STRINGS.es;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const launcherRef = useRef(null);
  const openedOnce = useRef(false);

  const openChat = useCallback(() => {
    setTeaser(false);
    setMounted(true);
    setOpen(true);
    if (!openedOnce.current) {
      openedOnce.current = true;
      trackChatEvent("chat_open", { language: lang });
    }
  }, [lang]);

  // Burbuja de invitación cuando la visita llega con ?chat=1.
  useEffect(() => {
    if (!chatRequestedInUrl()) return undefined;
    const timer = window.setTimeout(() => setTeaser(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Otros elementos del sitio (por ejemplo, la tarjeta "En línea" del inicio) abren el chat con este evento.
  useEffect(() => {
    window.addEventListener("v360:open-chat", openChat);
    return () => window.removeEventListener("v360:open-chat", openChat);
  }, [openChat]);

  const closeChat = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  return (
    <>
      {teaser && !open && (
        <div
          role="status"
          className="fixed right-4 bottom-[10.5rem] z-40 flex max-w-[17rem] items-start gap-2 rounded-2xl bg-white p-3 pr-2 text-left shadow-xl shadow-brand-900/20 ring-1 ring-slate-200 animate-fade-in-up md:right-6 md:bottom-24"
        >
          <button type="button" onClick={openChat} className="flex items-start gap-2 text-left">
            <img src="/favicon-48.png" alt="" width="32" height="32" className="h-8 w-8 shrink-0 rounded-full ring-1 ring-slate-200" />
            <span className="text-sm leading-5 text-slate-800">
              <span className="block font-semibold text-slate-900">{s.teaserTitle}</span>
              {s.teaserText}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTeaser(false)}
            aria-label={s.teaserDismiss}
            className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={open ? closeChat : openChat}
        aria-expanded={open}
        aria-controls="v360-chat"
        aria-label={open ? s.close : s.launcher}
        className={`fixed right-4 bottom-[5.75rem] z-40 inline-flex items-center gap-2 rounded-full bg-brand-700 p-4 font-semibold text-white shadow-xl shadow-brand-900/30 transition hover:bg-brand-800 focus-visible:ring-4 focus-visible:ring-brand-200 md:right-6 md:bottom-6 md:px-5 ${
          open ? "max-md:hidden" : ""
        }`}
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircleMore className="h-6 w-6" aria-hidden="true" />}
        <span className="hidden md:inline">{open ? s.close : s.launcher}</span>
      </button>

      {mounted && (
        <Suspense fallback={null}>
          <ChatPanel open={open} onClose={closeChat} lang={lang} />
        </Suspense>
      )}
    </>
  );
}
