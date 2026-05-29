import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import PersonalOS from "./components/PersonalOS.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersonalOS />
  </StrictMode>
);
