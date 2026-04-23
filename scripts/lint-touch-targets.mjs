#!/usr/bin/env node
/**
 * Lint de touch targets mobile (<44px / h-11).
 *
 * Escaneia src/**\/*.{ts,tsx} procurando elementos clicáveis
 * (Button, button, IconButton, [role="button"], onClick em a/div/span)
 * com `h-{n}` onde n < 11 (Tailwind: 1rem * n / 4 → h-11 = 44px).
 *
 * Uso:  node scripts/lint-touch-targets.mjs
 * Exit: 0 quando sem violações; 1 quando há violações.
 *
 * Considera padrões aceitáveis (badges, ícones decorativos, chips inline)
 * via lista de exclusão por contexto.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// h-1..h-10 (h-11 = 44px é o mínimo aceitável).
const SMALL_HEIGHT_RE = /\bh-(?:[1-9]|10)\b/;
// Apenas linhas que parecem clicáveis.
const CLICKABLE_RE = /(<Button\b|<button\b|onClick=|role=["']button["']|<IconButton\b|<a\s|<Link\b)/;
// Excluir badges/chips/icons decorativos comuns.
const SAFE_CONTEXT_RE = /(Badge|badge|<Avatar|<Icon|<Loader|Skeleton|h-[0-9]+\s+w-[0-9]+["'\s]*\/?>$|aria-hidden)/;

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
}
walk(SRC);

const violations = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (!SMALL_HEIGHT_RE.test(line)) return;
    if (!CLICKABLE_RE.test(line)) return;
    if (SAFE_CONTEXT_RE.test(line)) return;
    violations.push({
      file: relative(ROOT, file),
      line: i + 1,
      excerpt: line.trim().slice(0, 200),
    });
  });
}

if (violations.length === 0) {
  console.log("✓ Touch targets OK — nenhum elemento clicável com altura < 44px detectado.");
  process.exit(0);
}

console.log(`⚠ ${violations.length} possível(is) violação(ões) de touch target (<44px / h-11):\n`);
for (const v of violations) {
  console.log(`  ${v.file}:${v.line}`);
  console.log(`    ${v.excerpt}\n`);
}
console.log("Sugestão: usar h-11 (44px) ou maior em ações primárias mobile.");
console.log("Para ignorar (ex: ícone decorativo), adicione 'aria-hidden' ou envolva em Badge.");
process.exit(1);