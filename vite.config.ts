import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Isolate heavy Excel/workbook libraries into a lazy chunk
          if (id.includes("exceljs") || id.includes("xlsx-compat") || id.includes("lib/workbook")) {
            return "vendor-excel";
          }
          // Isolate PDF generation
          if (id.includes("jspdf") || id.includes("html2canvas")) {
            return "vendor-pdf";
          }
          // Isolate PPTX generation
          if (id.includes("pptxgenjs")) {
            return "vendor-pptx";
          }
          // Core vendor chunk
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
        },
      },
    },
  },
}));
