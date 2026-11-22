import { Phone } from "lucide-react";
import { NAV_LINKS } from "../content.js";
import { PHONE_DISPLAY, PHONE_E164 } from "../config.js";
import { Logo, WhatsAppLink } from "./ui.jsx";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <Logo className="h-10 w-auto" />
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">
            Conectamos lo que te importa. Te ayudamos a comparar opciones de servicios esenciales para tu hogar.
          </p>
        </div>

        <nav aria-label="Pie de página">
          <h2 className="text-sm font-semibold text-slate-900">Navegación</h2>
          <ul className="mt-3 space-y-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-sm text-slate-600 hover:text-brand-700">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Contacto</h2>
          <a
            href={`tel:${PHONE_E164}`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-700"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {PHONE_DISPLAY}
          </a>
          <div className="mt-4">
            <WhatsAppLink className="px-5 py-2.5 text-sm">WhatsApp</WhatsAppLink>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © {year} Vínculos 360. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
