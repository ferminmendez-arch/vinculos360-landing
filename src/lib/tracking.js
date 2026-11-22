/* =========================================================
   ATRIBUCIÓN DE MARKETING
   Captura UTM / fbclid. Se guardan en sessionStorage al llegar,
   para que la atribución no se pierda si la URL cambia durante
   la visita.
========================================================= */

const STORAGE_KEY = "v360_attribution";

function readStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function captureFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let referrerHost = "";
  if (document.referrer) {
    try {
      const host = new URL(document.referrer).hostname;
      if (host !== window.location.hostname) referrerHost = host;
    } catch {
      referrerHost = "";
    }
  }
  return {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    fbclid: params.get("fbclid") || "",
    referrerHost,
  };
}

/* Llamar una vez al cargar la página. */
export function initAttribution() {
  const fresh = captureFromUrl();
  const hasCampaignData = fresh.utmSource || fresh.fbclid;
  if (hasCampaignData || !readStored()) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* almacenamiento no disponible: se usa la URL actual */
    }
  }
}

function detectDevice() {
  const width = window.innerWidth;
  if (width < 768) return "Mobile";
  if (width < 1024) return "Tablet";
  return "Desktop";
}

/*
  Devuelve los mismos campos que usa la hoja de Leads en producción:
  source, medium, campaign, ad, fbclid, device.
*/
export function getTrackingData() {
  const data = readStored() || captureFromUrl();
  return {
    source: data.utmSource || data.referrerHost || "Direct",
    medium: data.utmMedium || "",
    campaign: data.utmCampaign || "",
    ad: data.utmContent || "",
    fbclid: data.fbclid || "",
    device: detectDevice(),
  };
}
