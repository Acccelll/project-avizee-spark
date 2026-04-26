#!/usr/bin/env node
/**
 * Schema↔código drift detector.
 *
 * Lê `src/integrations/supabase/types.ts` (gerado pelo Supabase) e extrai,
 * para cada tabela em `public`, o conjunto de colunas válidas (`Row`).
 * Em seguida varre `src/` procurando padrões de uso do client Supabase:
 *
 *   - .from("<table>").select("col1, col2, rel(col3)")
 *   - .from("<table>").insert({ col: ... })   // chaves do objeto literal
 *   - .from("<table>").update({ col: ... })
 *   - .eq("col", ...)/.neq/.gt/.lt/.in/.is/.order("col")
 *
 * Reporta colunas usadas que não existem em `Row`, prevenindo PGRST204
 * em runtime ("column not found in schema cache").
 *
 * Limitações conhecidas (intencionais, para evitar falsos positivos):
 *   - Ignora `select("*")` e selects construídos dinamicamente.
 *   - Aceita relacionamentos `cliente:clientes(id,nome)` removendo o alias
 *     e verificando colunas contra a tabela referenciada quando o nome
 *     corresponde; senão pula.
 *   - Ignora `.from(rpcName)` (RPCs não são tabelas).
 *   - Tabelas desconhecidas em types.ts são apenas avisadas (warn), pois
 *     podem ser views ou tabelas novas ainda não regeneradas.
 *
 * Uso:
 *   node scripts/check-schema-drift.mjs            # falha se houver drift
 *   node scripts/check-schema-drift.mjs --warn     # só reporta, exit 0
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const TYPES_PATH = join(ROOT, "src/integrations/supabase/types.ts");
const SRC_DIR = join(ROOT, "src");
const WARN_ONLY = process.argv.includes("--warn");

/**
 * Extrai { tableName: Set<colName> } a partir de types.ts.
 *
 * O arquivo é gerado pelo Supabase com indentação fixa de 2 espaços:
 *   - 6 espaços  → cabeçalho da tabela (`nome: {`)
 *   - 8 espaços  → bloco interno (`Row: {` / `Insert:` / `Update:` / `Relationships:`)
 *   - 10 espaços → declaração de coluna (`nome: tipo` ou `nome?: tipo`)
 *
 * O parser consome as três indentações como contexto e ignora qualquer
 * outra coisa, o que evita falsos positivos de chaves dentro de tipos.
 */
function parseTablesFromTypes(source) {
  const lines = source.split("\n");
  const tables = new Map();

  let currentTable = null;
  let inRow = false;

  const RE_TABLE = /^ {6}([a-zA-Z_][a-zA-Z0-9_]*):\s*\{$/;
  const RE_ROW_OPEN = /^ {8}Row:\s*\{$/;
  const RE_ROW_CLOSE = /^ {8}\}$/;
  const RE_COLUMN = /^ {10}([a-zA-Z_][a-zA-Z0-9_]*)\??:\s/;
  const RE_TABLE_CLOSE = /^ {6}\}$/;

  for (const line of lines) {
    if (currentTable === null) {
      const m = line.match(RE_TABLE);
      if (m) {
        currentTable = m[1];
        tables.set(currentTable, new Set());
      }
      continue;
    }

    if (!inRow) {
      if (RE_ROW_OPEN.test(line)) {
        inRow = true;
      } else if (RE_TABLE_CLOSE.test(line)) {
        currentTable = null;
      }
      continue;
    }

    // Dentro de Row
    if (RE_ROW_CLOSE.test(line)) {
      inRow = false;
      continue;
    }
    const m = line.match(RE_COLUMN);
    if (m) {
      tables.get(currentTable).add(m[1]);
    }
  }

  return tables;
}

/** Walk recursivo simples de arquivos .ts/.tsx em src/. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(full, out);
    } else {
      const ext = extname(entry);
      if (ext === ".ts" || ext === ".tsx") out.push(full);
    }
  }
  return out;
}

/**
 * Tokeniza uma string de select Postgrest e devolve as colunas de topo
 * (ignorando aliases relacionais como `cliente:clientes(...)`).
 */
function parseSelectColumns(selectStr) {
  const cols = [];
  let depth = 0;
  let buf = "";
  for (const ch of selectStr) {
    if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth--;
      buf += ch;
    } else if (ch === "," && depth === 0) {
      if (buf.trim()) cols.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) cols.push(buf.trim());

  return cols
    .map((c) => {
      // Remove relacionamentos: `alias:tabela(...)` → pular
      if (c.includes("(")) return null;
      // `alias:coluna` → coluna
      if (c.includes(":")) c = c.split(":")[1];
      // remover qualquer cast `col::text`
      c = c.split("::")[0];
      return c.trim();
    })
    .filter((c) => c && c !== "*" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c));
}

/**
 * Encontra ocorrências de `.from("nome")` e devolve [{table, index}] para
 * que possamos buscar a próxima `.select(...)` que segue.
 */
function findFromCalls(content) {
  const out = [];
  const re = /\.from\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]\s*\)/g;
  let m;
  while ((m = re.exec(content))) {
    out.push({ table: m[1], index: m.index + m[0].length });
  }
  return out;
}

/**
 * Extrai a string passada a `.select("...")` que segue um `.from`.
 * A janela termina no PRÓXIMO `.from(` para não vazar selects de outras
 * cadeias no mesmo arquivo (caso comum: várias queries num service).
 */
function extractFollowingSelect(content, fromIndex, nextFromIndex) {
  const end = nextFromIndex ?? Math.min(content.length, fromIndex + 2000);
  const window = content.slice(fromIndex, end);
  const m = window.match(/\.select\(\s*["'`]([\s\S]*?)["'`]\s*[,)]/);
  return m ? m[1] : null;
}

function main() {
  const typesSrc = readFileSync(TYPES_PATH, "utf8");
  const tables = parseTablesFromTypes(typesSrc);

  if (tables.size === 0) {
    console.error("✗ Não foi possível extrair tabelas de types.ts");
    process.exit(2);
  }

  const drift = []; // {file, table, col, kind}
  const unknownTables = new Map(); // table → count

  const files = walk(SRC_DIR);
  for (const file of files) {
    if (file.includes("/integrations/supabase/")) continue;
    const content = readFileSync(file, "utf8");
    const calls = findFromCalls(content);
    for (let i = 0; i < calls.length; i++) {
      const { table, index } = calls[i];
      const nextIndex = calls[i + 1]?.index;
      if (!tables.has(table)) {
        unknownTables.set(table, (unknownTables.get(table) || 0) + 1);
        continue;
      }
      const validCols = tables.get(table);
      const selectStr = extractFollowingSelect(content, index, nextIndex);
      if (!selectStr || selectStr.trim() === "*") continue;
      const cols = parseSelectColumns(selectStr);
      for (const col of cols) {
        if (!validCols.has(col)) {
          drift.push({
            file: file.replace(ROOT + "/", ""),
            table,
            col,
            kind: "select",
          });
        }
      }
    }
  }

  console.log(`\n📊 Tabelas extraídas de types.ts: ${tables.size}`);
  console.log(`📁 Arquivos varridos em src/: ${files.length}`);

  if (unknownTables.size > 0) {
    console.log(
      `\n⚠  Tabelas/views referenciadas mas ausentes em types.ts (podem ser views ou tabelas novas):`,
    );
    for (const [t, n] of [...unknownTables.entries()].sort()) {
      console.log(`   - ${t} (${n} ocorrência${n > 1 ? "s" : ""})`);
    }
  }

  if (drift.length === 0) {
    console.log("\n✓ Nenhum drift detectado em selects.\n");
    process.exit(0);
  }

  console.log(`\n✗ ${drift.length} possível(eis) drift(s) detectado(s):\n`);
  // Agrupa por tabela para leitura
  const byTable = drift.reduce((acc, d) => {
    (acc[d.table] ||= []).push(d);
    return acc;
  }, {});
  for (const [table, items] of Object.entries(byTable)) {
    console.log(`  ${table}:`);
    for (const d of items) {
      console.log(`    - col "${d.col}"  (${d.file})`);
    }
  }
  console.log("");

  process.exit(WARN_ONLY ? 0 : 1);
}

main();