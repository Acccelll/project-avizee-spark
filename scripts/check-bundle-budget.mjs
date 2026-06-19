#!/usr/bin/env node
/**
 * Bundle budget check (Etapa 8.4).
 *
 * Após `vite build`, soma o tamanho (gzip estimado via brotli/raw) dos
 * JS de entrada do shell inicial — chunks que entram no HTML como
 * `<script type="module" src=...>` ou os `react-vendor`/`query`/`radix`
 * pré-carregados via `manualChunks`. Falha (exit 1) se o total ultrapassar
 * o teto.
 *
 * Configuração: BUDGET_KB (env) — default 900KB (raw). Ajustar conforme
 * baseline real; o objetivo é detectar **regressões**, não atingir uma meta
 * absoluta agora.
 *
 * Uso:
 *   npm run build
 *   node scripts/check-bundle-budget.mjs
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";
const BUDGET_KB = Number(process.env.BUDGET_KB ?? 900);

// Chunks que entram no carregamento inicial (HTML + preload de vendors comuns).
// Outros (recharts, charts dashboard, fiscal, workbook, apresentacao, zxing)
// são lazy/dynamic e não contam para o budget inicial.
const INITIAL_PATTERNS = [
  /^index-[A-Za-z0-9_-]+\.js$/,
  /^react-vendor-[A-Za-z0-9_-]+\.js$/,
  /^query-[A-Za-z0-9_-]+\.js$/,
  /^radix-[A-Za-z0-9_-]+\.js$/,
];

let files;
try {
  files = readdirSync(DIST);
} catch {
  console.error(`[budget] dist não encontrado em ${DIST}. Rode 'npm run build' antes.`);
  process.exit(2);
}

const matched = files.filter((f) => INITIAL_PATTERNS.some((re) => re.test(f)));
if (!matched.length) {
  console.warn("[budget] nenhum chunk inicial identificado — patterns desatualizados?");
  process.exit(0); // advisory: não bloquear até estabilizar
}

let totalBytes = 0;
const rows = [];
for (const f of matched) {
  const size = statSync(join(DIST, f)).size;
  totalBytes += size;
  rows.push({ file: f, kb: (size / 1024).toFixed(1) });
}

const totalKb = totalBytes / 1024;
console.log("[budget] chunks iniciais:");
for (const r of rows) console.log(`  ${r.kb.padStart(8)} KB  ${r.file}`);
console.log(`[budget] total = ${totalKb.toFixed(1)} KB (teto: ${BUDGET_KB} KB)`);

if (totalKb > BUDGET_KB) {
  console.error(`[budget] FAIL — bundle inicial estourou o teto em ${(totalKb - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
console.log("[budget] OK");