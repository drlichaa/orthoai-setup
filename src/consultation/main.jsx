import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./consultation.css";
import ConsultationApp from "./ConsultationApp.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConsultationApp />
  </StrictMode>,
);
