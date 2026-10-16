import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./consultation.css";
import ConsultationApp from "./ConsultationApp.jsx";

// Sur téléphone : version iPhone, sauf si la version complète est demandée (?complet=1).
const telephone = window.matchMedia("(max-width: 600px) and (pointer: coarse)").matches;
if (telephone && !new URLSearchParams(window.location.search).has("complet")) window.location.replace("/mobile.html");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConsultationApp />
  </StrictMode>,
);
