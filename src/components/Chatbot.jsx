import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleMore, X } from "lucide-react";
import { useLang } from "../i18n.js";
import { CHAT_STRINGS } from "../lib/chatbot/strings.js";
import { trackChatEvent } from "../lib/chatbot/api.js";
import { SERVICE_KEYS } from "../lib/chatbot/flow.js";
import { OPEN_CHAT_EVENT, chatRequestedInUrl } from "../lib/chatbot/open.js";

/* El panel se descarga solo cuando alguien abre el chat,
   para no aumentar el peso inicial de la página. */
const ChatPanel = lazy(() => import("./ChatPanel.jsx"));

const ATTENTION_MS = 6000;

/* Único punto de entrada al chat. En computadora es el botón flotante;
   en celular el chat se abre desde la barra inferior (MobileCtaBar). */
export default function Chatbot() {
  const lang = useLang();
  const s = CHAT_STRINGS[lang] || CHAT_STRINGS.es;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [request, setRequest] = useState({ serviceKey: "", n: 0 });
  const [attention, setAttention] = useState(chatRequestedInUrl);
  const launcherRef = useRef(null);
  const openedOnce = useRef(false);
  const returnFocusRef = useRef(null);

  const openChat = useCallback(
    (event) => {
      const serviceKey = event?.detail?.serviceKey;
      if (SERVICE_KEYS.includes(serviceKey)) setRequest((prev) => ({ serviceKey, n: prev.n + 1 }));
      // Al cerrar, el foco vuelve al botón que abrió el chat (en celular, la barra inferior).
      const opener = document.activeElement;
      returnFocusRef.current = opener instanceof HTMLElement && opener !== document.body ? opener : null;
      setMounted(true);
      setOpen(true);
      setAttention(false);
      if (!openedOnce.current) {
        openedOnce.current = true;
        trackChatEvent("chat_open", { language: lang });
      }
    },
    [lang],
  );

  useEffect(() => {
    window.addEventListener(OPEN_CHAT_EVENT, openChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openChat);
  }, [openChat]);

  // Con ?chat=1 el botón se resalta unos segundos, sin abrir nada por su cuenta.
  useEffect(() => {
    if (!attention) return undefined;
    const id = window.setTimeout(() => setAttention(false), ATTENTION_MS);
    return () => window.clearTimeout(id);
  }, [attention]);

  const closeChat = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : launcherRef.current;
      target?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={open ? closeChat : () => openChat()}
        aria-expanded={open}
        aria-controls="v360-chat"
        aria-label={open ? s.close : s.launcher}
        className={`fixed right-6 bottom-6 z-40 hidden items-center gap-2 rounded-full bg-brand-700 py-3.5 pr-5 pl-4 font-semibold text-white shadow-xl shadow-brand-900/30 transition hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:ring-4 focus-visible:ring-brand-200 md:inline-flex ${
          attention ? "animate-attention" : ""
        }`}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircleMore className="h-5 w-5" aria-hidden="true" />}
        <span>{open ? s.close : s.launcher}</span>
      </button>

      {mounted && (
        <Suspense fallback={null}>
          <ChatPanel open={open} onClose={closeChat} lang={lang} request={request} />
        </Suspense>
      )}
    </>
  );
}
