import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initAttribution } from "./lib/tracking.js";
import { langFromPath } from "./i18n.js";

initAttribution();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App lang={langFromPath(window.location.pathname)} />
  </StrictMode>
);
