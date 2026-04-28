import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega .env / .env.<mode> para o escopo do config. Sem isto, `process.env`
  // não enxerga as vars do arquivo .env (Vite só popula `import.meta.env`),
  // o que fazia o `define` abaixo emitir strings vazias e quebrar
  // `isSupabaseConfigured` em runtime (bug observado no /login do preview).
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  return {
  define: {
    // Sem fallback hardcoded: o ambiente DEVE prover essas envs.
    // O Lovable Cloud injeta automaticamente em preview/produção; em dev local,
    // copie .env.example para .env. `isSupabaseConfigured` em
    // src/integrations/supabase/client.ts trata o caso de envs ausentes.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      env.VITE_SUPABASE_URL ?? "",
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        env.VITE_SUPABASE_ANON_KEY ||
        "",
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      env.VITE_SUPABASE_PROJECT_ID ?? "",
    ),
    "import.meta.env.VITE_APP_URL": JSON.stringify(
      env.VITE_APP_URL ?? "",
    ),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  esbuild: {
    // Strip de console.* e debugger no bundle de produção.
    // Logs críticos em dev devem usar `@/lib/logger` para preservar rastreabilidade.
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  };
});
