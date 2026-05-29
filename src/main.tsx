import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.tsx";
import PersonalOS from "./components/PersonalOS.tsx";

function Root() {
  const [mode, setMode] = useState<"goals" | "os">(() =>
    (localStorage.getItem("app_mode") as "goals" | "os") ?? "os"
  );

  const toggle = () => {
    const next = mode === "goals" ? "os" : "goals";
    localStorage.setItem("app_mode", next);
    setMode(next);
  };

  return (
    <>
      <button
        onClick={toggle}
        style={{
          position: "fixed", top: 10, right: 12, zIndex: 9999,
          background: "#2563eb", color: "#fff", border: "none",
          borderRadius: 8, padding: "4px 12px", fontSize: 12,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {mode === "os" ? "Weekly Goals ↗" : "My OS ↗"}
      </button>
      {mode === "os" ? <PersonalOS /> : <App />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
