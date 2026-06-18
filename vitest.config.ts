import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/__tests__/**",
        "src/test/**",
        "src/integrations/supabase/types.ts",
        "src/integrations/supabase/client.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Floors anti-regressão. Etapa 7.2: subir gradualmente conforme
      // novos testes de services entram. Alvo final (roadmap): global 60%,
      // src/services/** e src/utils/** 80%.
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 20,
        branches: 45,
        "src/utils/**": {
          lines: 70,
          statements: 70,
          functions: 80,
          branches: 75,
        },
        "src/services/**": {
          lines: 12,
          statements: 12,
          functions: 20,
          branches: 60,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
