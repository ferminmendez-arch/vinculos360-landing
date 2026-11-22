import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "../lib/whatsapp.js";

export function SectionHeading({ eyebrow, title, description, tone = "light", id }) {
  const dark = tone === "dark";
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase ${
          dark
            ? "border border-white/15 bg-white/10 text-brand-100"
            : "border border-brand-100 bg-brand-50 text-brand-700"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl ${
          dark ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-base leading-7 text-pretty sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>
          {description}
        </p>
      )}
    </div>
  );
}

const WA_VARIANTS = {
  solid:
    "bg-wa-600 text-white shadow-md shadow-wa-600/20 hover:bg-wa-700",
  outline:
    "border border-slate-300 bg-white text-slate-800 hover:border-wa-600 hover:text-wa-700",
  light:
    "border border-white/25 bg-white/10 text-white hover:bg-white/20",
};

export function WhatsAppLink({ message, children = "WhatsApp", variant = "solid", className = "", onClick }) {
  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors ${WA_VARIANTS[variant]} ${className}`}
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
      <span className="sr-only">(se abre en una nueva pestaña)</span>
    </a>
  );
}

export function Logo({ className = "h-9 w-auto sm:h-10" }) {
  return (
    <img
      src="/img/logo-vinculos360.png"
      alt="Vínculos 360"
      width="407"
      height="120"
      className={className}
      decoding="async"
    />
  );
}
