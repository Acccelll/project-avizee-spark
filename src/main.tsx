import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isSupabaseConfigured } from "./integrations/supabase/client";

if (!isSupabaseConfigured) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 520, textAlign: "center", padding: 24 }}>
        <h1>Variáveis de ambiente do Supabase não configuradas</h1>
        <p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para iniciar o app.</p>
      </div>
    </div>,
  );
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
