/* Un solo chat en todo el sitio: cualquier botón lo abre con este evento,
   opcionalmente con el servicio ya elegido (por ejemplo, desde una tarjeta de servicio). */
export const OPEN_CHAT_EVENT = "v360:open-chat";

export function openChat(serviceKey = "") {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { serviceKey } }));
}

/* vinculos360.com/?chat=1 (enlace desde WhatsApp): el chat NO se abre solo;
   el botón del chat se resalta unos segundos para que la persona lo encuentre. */
export function chatRequestedInUrl() {
  if (typeof window === "undefined") return false;
  return ["1", "abrir", "open"].includes(new URLSearchParams(window.location.search).get("chat"));
}
