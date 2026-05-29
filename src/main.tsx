import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import PersonalOS from "./components/PersonalOS.tsx";
import LockScreen from "./components/LockScreen.tsx";

function App() {
  const isDev = import.meta.env.DEV;
  const [authed, setAuthed] = useState(() => isDev || localStorage.getItem("site_authed") === "1");
  if (!authed) return <LockScreen onUnlock={() => setAuthed(true)} />;
  return <PersonalOS />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
