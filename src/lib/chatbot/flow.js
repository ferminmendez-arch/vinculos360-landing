/* =========================================================
   FLUJO DETERMINISTA DEL CHATBOT (sin IA)

   El estado de la conversación es un objeto simple. `nextStep`
   decide cuál es la siguiente pregunta según lo que falta, y
   `answer` / `back` producen un estado nuevo (inmutable).
   La conversación visible se reconstruye a partir del estado,
   así que "Atrás" y "Empezar de nuevo" no pueden desincronizarse.
========================================================= */

import {
  CONSENT_VERSION,
  QUESTIONS,
  SERVICE_KEYS,
  SKIP,
  parseAmount,
  savingsEstimate,
  checkEmail,
  checkName,
  checkPhone,
  checkZip,
  cleanEmail,
  cleanName,
  digitsOnly,
  formatUsPhone,
  qualify,
} from "../../../api/src/lib/rules.js";

export { CONSENT_VERSION, SERVICE_KEYS, QUESTIONS, SKIP };

export const INITIAL_STATE = Object.freeze({
  serviceKey: "",
  answers: Object.freeze({}),
  zipCode: "",
  name: "",
  preferredContact: "",
  phone: "",
  email: "",
  history: Object.freeze([]),
});

/* Pasos en orden. Cada uno: { id, kind: "choice" | "number" | "input" | "consent", options? } */
export function stepsFor(state) {
  const steps = [{ id: "service", kind: "choice", options: SERVICE_KEYS }];
  if (!state.serviceKey) return steps;
  for (const q of QUESTIONS[state.serviceKey]) {
    if (q.askIf && !q.askIf(state.answers)) continue;
    steps.push(q.kind === "number" ? { id: `q:${q.id}`, kind: "number", min: q.min, max: q.max } : { id: `q:${q.id}`, kind: "choice", options: q.options });
  }
  steps.push({ id: "zipCode", kind: "input" });
  steps.push({ id: "name", kind: "input" });
  steps.push({ id: "preferredContact", kind: "choice", options: ["whatsapp", "llamada", "texto", "correo"] });
  if (state.preferredContact === "correo") steps.push({ id: "email", kind: "input" });
  steps.push({ id: "phone", kind: "input" });
  steps.push({ id: "consent", kind: "consent" });
  return steps;
}

export function valueOf(state, stepId) {
  if (stepId === "service") return state.serviceKey;
  if (stepId.startsWith("q:")) return state.answers[stepId.slice(2)] || "";
  if (stepId === "consent") return "";
  return state[stepId] || "";
}

/* Primer paso sin respuesta. */
export function nextStep(state) {
  return stepsFor(state).find((s) => !valueOf(state, s.id)) || null;
}

/* Pasos ya respondidos, en orden, para dibujar la conversación. */
export function answeredSteps(state) {
  const out = [];
  for (const step of stepsFor(state)) {
    if (!valueOf(state, step.id)) break;
    out.push(step);
  }
  return out;
}

/* Valida y normaliza una respuesta escrita. Devuelve { value } o { error }. */
export function checkInput(stepId, raw, state) {
  const numberStep = stepsFor(state).find((s) => s.id === stepId && s.kind === "number");
  if (numberStep) {
    const value = parseAmount(raw);
    if (value === null) return { error: "number_invalid" };
    if (Number(value) < numberStep.min) return { error: `${stepId.slice(2)}_low` };
    if (Number(value) > numberStep.max) return { error: `${stepId.slice(2)}_high` };
    return { value };
  }
  switch (stepId) {
    case "zipCode": {
      const error = checkZip(raw);
      return error ? { error } : { value: digitsOnly(raw) };
    }
    case "name": {
      const error = checkName(raw);
      return error ? { error } : { value: cleanName(raw) };
    }
    case "phone": {
      const error = checkPhone(raw);
      return error ? { error } : { value: formatUsPhone(raw) };
    }
    case "email": {
      const error = checkEmail(raw, state.preferredContact === "correo");
      return error ? { error } : { value: cleanEmail(raw) };
    }
    default:
      return { error: "unknown_step" };
  }
}

/* Aplica una respuesta al paso actual. Las respuestas que dependen de
   un paso anterior (por ejemplo, el correo) se limpian si cambian. */
export function answer(state, stepId, value) {
  const step = nextStep(state);
  if (!step || step.id !== stepId) return state;
  if (step.kind === "choice" && !step.options.includes(value)) return state;
  if (step.kind === "number" && value !== SKIP && parseAmount(value) === null) return state;

  const history = [...state.history, stepId];
  if (stepId === "service") return { ...INITIAL_STATE, serviceKey: value, history };
  if (stepId.startsWith("q:")) {
    const answers = { ...state.answers, [stepId.slice(2)]: value };
    // Si una respuesta hace que otra pregunta ya no aplique, se borra esa respuesta.
    for (const q of QUESTIONS[state.serviceKey]) if (q.askIf && !q.askIf(answers)) delete answers[q.id];
    return { ...state, answers, history };
  }
  if (stepId === "preferredContact") {
    return { ...state, preferredContact: value, email: value === "correo" ? state.email : "", history };
  }
  return { ...state, [stepId]: value, history };
}

/* Deshace la última respuesta. */
export function back(state) {
  if (!state.history.length) return state;
  const last = state.history[state.history.length - 1];
  const history = state.history.slice(0, -1);
  if (last === "service") return { ...INITIAL_STATE };
  if (last.startsWith("q:")) {
    const answers = { ...state.answers };
    delete answers[last.slice(2)];
    return { ...state, answers, history };
  }
  return { ...state, [last]: "", history };
}

/* Payload para POST /api/leads (mismas claves que valida la API). */
export function buildLeadPayload(state, { language, tracking, elapsedMs, consent }) {
  return {
    serviceKey: state.serviceKey,
    answers: { ...state.answers },
    name: state.name,
    phone: state.phone,
    zipCode: state.zipCode,
    email: state.email,
    preferredContact: state.preferredContact,
    consent: consent === true,
    consentVersion: CONSENT_VERSION,
    language,
    elapsedMs: Math.round(elapsedMs),
    company: "",
    ...tracking,
  };
}

export function estimateSavings(state) {
  return savingsEstimate({ serviceKey: state.serviceKey, answers: state.answers });
}

export function prequalify(state) {
  return qualify({ serviceKey: state.serviceKey, answers: state.answers, zipCode: state.zipCode, consent: true });
}
