/* Idiomas del sitio: español en "/" e inglés en "/en/". */

export const LANGS = ["es", "en"];

export function langFromPath(pathname) {
  return /^\/en(\/|$)/.test(pathname || "") ? "en" : "es";
}

/* Ruta equivalente en el otro idioma, conservando ?query y #ancla. */
export function alternateUrl(lang, { search = "", hash = "" } = {}) {
  return `${lang === "en" ? "/en/" : "/"}${search}${hash}`;
}
