import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { MessageCircleMore, X } from "lucide-react";
import { useLang } from "../i18n.js";
import { CHAT_STRINGS } from "../lib/chatbot/strings.js";
import { trackChatEvent } from "../lib/chatbot/api.js";

/* El panel se descarga solo cuando alguien abre el chat,
   para no aumentar el peso inicial de la página. */
const ChatPanel = lazy(() => import("./ChatPanel.jsx"));

export default function Chatbot() {
  const lang = useLang();
  const s = CHAT_STRINGS[lang] || CHAT_STRINGS.es;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const launcherRef = useRef(null);
  const openedOnce = useRef(false);

  const openChat = () => {
    setMounted(true);
    setOpen(true);
    if (!openedOnce.current) {
      openedOnce.current = true;
      trackChatEvent("chat_open", { language: lang });
    }
  };

  const closeChat = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  return (
    <>
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
