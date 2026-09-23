import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applySeo } from "./components/seo/Seo";
import { resolveRouteSeo } from "./lib/seo";
import "./index.css";

// O App só monta o Router depois do bootSession (rede). Aplicar o <head> da
// rota já aqui evita a aba presa no título da landing durante esse intervalo.
applySeo(resolveRouteSeo(window.location.pathname));

createRoot(document.getElementById("root")!).render(<App />);
