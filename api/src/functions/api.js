/* Registro de los endpoints en Azure Functions (modelo de programación v4).
   Toda la lógica está en ../lib/handlers.js. */
import { app } from "@azure/functions";
import { handleEvent, handleHealth, handleLead } from "../lib/handlers.js";

function logger(context) {
  return { info: (m) => context.log(m), warn: (m) => context.warn(m), error: (m) => context.error(m) };
}

app.http("leads", {
  route: "leads",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request, context) => handleLead(request, { log: logger(context) }),
});

app.http("chat-event", {
  route: "chat-event",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request, context) => handleEvent(request, { log: logger(context) }),
});

app.http("health", {
  route: "health",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: () => handleHealth(),
});
