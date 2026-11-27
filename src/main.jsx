import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initAttribution } from "./lib/tracking.js";
import { initAnalytics } from "./lib/analytics.js";
import { langFromPath } from "./i18n.js";

initAttribution();
initAnalytics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App lang={langFromPath(window.location.pathname)} />
  </StrictMode>
);
