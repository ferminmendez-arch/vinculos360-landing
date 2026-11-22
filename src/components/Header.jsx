import { useEffect, useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { NAV_LINKS } from "../content.js";
import { PHONE_DISPLAY, PHONE_E164 } from "../config.js";
import { Logo, WhatsAppLink } from "./ui.jsx";

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="#inicio" className="flex shrink-0 items-center rounded-lg" aria-label="Vínculos 360 — Inicio">
          <Logo />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${PHONE_E164}`}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:text-brand-700 xl:inline-flex"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {PHONE_DISPLAY}
          </a>

          <WhatsAppLink className="px-4 py-2.5 text-sm sm:px-5">
            <span className="hidden sm:inline">Escríbenos por </span>WhatsApp
          </WhatsAppLink>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
            aria-expanded={open}
            aria-controls="menu-movil"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
          </button>
        </div>
      </div>

      <nav
        id="menu-movil"
        aria-label="Menú móvil"
        className={`border-t border-slate-200 bg-white lg:hidden ${open ? "block" : "hidden"}`}
      >
        <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-base font-medium text-slate-800 hover:bg-brand-50 hover:text-brand-700"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={`tel:${PHONE_E164}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Llamar al {PHONE_DISPLAY}
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
