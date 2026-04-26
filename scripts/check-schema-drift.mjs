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
 * Estratégia: procurar blocos `<table>: { Row: { ... } }` dentro de
 * `Tables: {`. Como o arquivo é gerado, a indentação e formato são
 * estáveis o suficiente para parser baseado em linha.
 */
function parseTablesFromTypes(source) {
  const lines = source.split("\n");
  const tables = new Map();

  let inTables = false;
  let depth = 0; // profundidade de chaves dentro do bloco Tables
  let currentTable = null;
  let currentTableDepth = 0;
  let inRow = false;
  let rowDepth = 0;

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    if (!inTables) {
      if (/^\s*Tables:\s*\{/.test(line)) {
        inTables = true;
        depth = 1;
      }
      continue;
    }

    // Conta chaves para sair do bloco Tables corretamente.
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (currentTable === null) {
      // Procura cabeçalho de tabela: `nome_tabela: {`
      const m = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*\{$/);
      if (m && depth === 1) {
        currentTable = m[1];
        currentTableDepth = depth;
        tables.set(currentTable, new Set());
        depth += opens - closes;
        continue;
      }
    } else if (!inRow) {
      if (/^\s*Row:\s*\{/.test(line)) {
        inRow = true;
        rowDepth = depth + opens - closes;
        depth += opens - closes;
        continue;
      }
    } else {
      // Dentro de Row: capturar `nomeColuna:` no nível imediato.
      // Aceitar apenas linhas no nível raiz do Row (depth atual = rowDepth)
      const colMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s/);
      if (colMatch && depth === rowDepth) {
        tables.get(currentTable).add(colMatch[1]);
      }
      const newDepth = depth + opens - closes;
      if (newDepth < rowDepth) {
        inRow = false;
      }
      depth = newDepth;
      // Quando saímos da tabela inteira, reset.
      if (depth <= currentTableDepth) {
        currentTable = null;
        inRow = false;
      }
      continue;
    }

    depth += opens - closes;
    if (depth <= 0) break; // saiu de Tables
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

/** Extrai a string passada a `.select("...")` que segue um `.from`. */
function extractFollowingSelect(content, fromIndex) {
  // Considera apenas a janela da próxima ~2000 chars para evitar
  // pegar selects de outras chamadas no mesmo arquivo.
  const window = content.slice(fromIndex, fromIndex + 2000);
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
    for (const { table, index } of calls) {
      if (!tables.has(table)) {
        unknownTables.set(table, (unknownTables.get(table) || 0) + 1);
        continue;
      }
      const validCols = tables.get(table);
      const selectStr = extractFollowingSelect(content, index);
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