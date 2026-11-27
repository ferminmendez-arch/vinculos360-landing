/* Guías estáticas: atribución + medición sin datos personales.
   - Guarda de dónde llegó la visita (p. ej. google.com) con la misma clave que
     usa el sitio (v360_attribution), para que un lead posterior conserve el origen.
   - Google Analytics 4 (sin señales de Google ni personalización de anuncios).
   - whatsapp_clicked al abrir el chat con Vínculos 360. */
(function () {
  var KEY = "v360_attribution";
  var slug = (location.pathname.match(/^\/guias\/([^/]+)\//) || [])[1] || "indice";
  try {
    var params = new URLSearchParams(location.search);
    var hasCampaign = params.get("utm_source") || params.get("fbclid");
    if (hasCampaign || !sessionStorage.getItem(KEY)) {
      var ref = "";
      try { var h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h; } catch { ref = ""; }
      sessionStorage.setItem(KEY, JSON.stringify({
        utmSource: params.get("utm_source") || "",
        utmMedium: params.get("utm_medium") || "",
        utmCampaign: params.get("utm_campaign") || "",
        utmContent: params.get("utm_content") || "guia-" + slug,
        fbclid: params.get("fbclid") || "",
        referrerHost: ref
      }));
    }
  } catch { /* sin almacenamiento */ }

  var script = document.currentScript;
  var id = script && script.getAttribute("data-ga");
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (id && /^G-[A-Z0-9]{4,}$/.test(id)) {
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  function beacon(event) {
    try {
      var body = JSON.stringify({ event: event, language: "es", serviceKey: "electricidad" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/chat-event", new Blob([body], { type: "application/json" })))) {
        fetch("/api/chat-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
      }
    } catch { /* sin métricas */ }
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com\/send)\/?\d/.test(a.href)) {
      if (window.gtag) window.gtag("event", "whatsapp_clicked", { language: "es", entry_point: "guia" });
      beacon("whatsapp_clicked");
    } else if (a.closest(".cta") && window.gtag) {
      window.gtag("event", "guide_cta_click", { language: "es", entry_point: "guia" });
    }
  }, true);
})();
