import { Phone } from "lucide-react";
import { SECTION_IDS } from "../content.js";
import { useStrings } from "../i18n.js";
import { PHONE_DISPLAY, PHONE_E164 } from "../config.js";
import { FacebookLink, LanguageSwitch, Logo, WhatsAppLink } from "./ui.jsx";

export default function Footer() {
  const t = useStrings();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <Logo className="h-10 w-auto" />
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">
            {t.footer.about}
          </p>
        </div>

        <nav aria-label={t.footer.navLabel}>
          <h2 className="text-sm font-semibold text-slate-900">{t.footer.navTitle}</h2>
          <ul className="mt-3 space-y-2">
            {SECTION_IDS.map((id) => (
              <li key={id}>
                <a href={`#${id}`} className="text-sm text-slate-600 hover:text-brand-700">
                  {t.nav[id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t.footer.contactTitle}</h2>
          <a
            href={`tel:${PHONE_E164}`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-700"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {PHONE_DISPLAY}
          </a>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <LanguageSwitch />
            <WhatsAppLink className="px-5 py-2.5 text-sm">WhatsApp</WhatsAppLink>
            <FacebookLink className="h-11 w-11" />
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © {year} Vínculos 360. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
