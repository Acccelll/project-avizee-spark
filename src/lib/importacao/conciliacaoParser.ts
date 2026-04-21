/**
 * Parser dedicado da planilha "Conciliação_FluxoCaixa 2026.xlsx".
 *
 * Detecta as abas conhecidas (CR, CP, FC, FOPAG, CLIENTES, FORNECEDORES,
 * Plano de Contas, Centro de Custo) de forma case-insensitive e normaliza
 * cada linha em um shape estável, pronto para preview/staging.
 *
 * NÃO inventa estrutura: a aba FC nunca vira lançamento, vira apenas dado
 * de conferência. Centro de Custo é preservado em log para fase futura.
 */

import * as XLSX from "@/lib/xlsx-compat";
import { parseDateFlexible, parseDecimalFlexible } from "./parsers";
import { normalizeCpfCnpj, normalizeText, normalizeCep, normalizePhone, normalizeEmail } from "./normalizers";

/** Detecta tipo_pessoa pelo CPF/CNPJ (apenas dígitos). */
function detectTipoPessoa(cpfCnpj: string): "fisica" | "juridica" {
  const len = (cpfCnpj || "").replace(/\D/g, "").length;
  return len === 14 ? "juridica" : "fisica";
}

/** Converte valor "Pagt." (texto livre) em prazo em dias quando possível. */
function parsePrazoPadrao(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).toUpperCase();
  // Casos comuns: "28DDL", "30 DDL", "30 DIAS", "30"
  const m = s.match(/(\d+)/);
  if (m) return parseInt(m[1]);
  return null;
}

/** Match insensível a caixa/acento/espaços. */
function normHeader(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza nome para matching de pessoa (sem acento, upper, trim). */
export function normalizeNomeMatch(s: unknown): string {
  return normHeader(s);
}

/** Procura uma aba ignorando caixa/acento. */
function findSheet(wb: XLSX.WorkBook, candidates: string[]): string | null {
  const map = new Map(wb.SheetNames.map((n) => [normHeader(n), n]));
  for (const c of candidates) {
    const found = map.get(normHeader(c));
    if (found) return found;
  }
  return null;
}

/** Lê aba como array de objetos com chaves originais. */
function readSheetAsObjects(wb: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
  // Remove linhas totalmente vazias
  return rows.filter((r) => Object.values(r).some((v) => v !== null && v !== "" && v !== undefined));
}

/** Resolve o valor de uma linha por múltiplos nomes possíveis (insensível). */
function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const normMap = new Map<string, unknown>();
  for (const k of Object.keys(row)) normMap.set(normHeader(k), row[k]);
  for (const n of names) {
    const v = normMap.get(normHeader(n));
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

// ======================== TIPOS ========================

export type OrigemConciliacao = "CR" | "CP" | "FOPAG";

export interface FinanceiroConciliacaoRow {
  origem: OrigemConciliacao;
  tipo: "receber" | "pagar";
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  valor_pago: number;
  descricao: string;
  titulo: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  forma_pagamento: string | null;
  banco: string | null;
  conta_contabil_codigo: string | null;
  codigo_legado_pessoa: string | null;
  nome_abreviado: string | null;
  pmv_pmp: number | null;
  socio: string | null;
  _originalLine: number;
  _originalRow: Record<string, unknown>;
}

export interface FCRow {
  data_vencimento: string | null;
  tipo_raw: string;
  /** Normalizado: 'pagar' (Débito) | 'receber' (Crédito) | null */
  tipo: "receber" | "pagar" | null;
  codigo_pessoa: string | null;
  nome_abreviado: string | null;
  valor: number;
  status: string | null;
  _originalLine: number;
}

export interface PlanoContasRow {
  i_level: string | null;
  codigo: string;
  descricao: string;
  _originalLine: number;
}

export interface CentroCustoRow {
  codigo: string;
  descricao: string;
  responsavel: string | null;
  _originalLine: number;
}

export interface SinteticaRow {
  codigo: string;
  descricao: string;
  nivel: number | null;
  conta_pai_codigo: string | null;
  _originalLine: number;
}

export interface PessoaAuxRow {
  tipo_pessoa: "fisica" | "juridica";
  cpf_cnpj: string;
  codigo_legado: string;
  nome_razao_social: string;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  caixa_postal: string | null;
  observacoes: string | null;
  prazo_padrao: number | null;
  forma_pagamento_padrao: string | null;
  _originalLine: number;
}

export interface ProdutoInsumoRow {
  tipo_item: "produto" | "insumo";
  codigo_legado: string;
  sku: string;
  nome: string;
  grupo_nome: string | null;
  unidade_medida: string;
  variacoes: string | null;
  preco_custo: number;
  preco_venda: number;
  peso: number;
  ncm: string;
  estoque_inicial: number;
  fornecedor_principal_nome: string | null;
  fornecedor_principal_legado: string | null;
  ref_fornecedor: string | null;
  url_produto_fornecedor: string | null;
  _originalLine: number;
}

export interface ConciliacaoBundle {
  cr: FinanceiroConciliacaoRow[];
  cp: FinanceiroConciliacaoRow[];
  fopag: FinanceiroConciliacaoRow[];
  fc: FCRow[];
  planoContas: PlanoContasRow[];
  centroCusto: CentroCustoRow[];
  sinteticas: SinteticaRow[];
  clientes: PessoaAuxRow[];
  fornecedores: PessoaAuxRow[];
  produtos: ProdutoInsumoRow[];
  insumos: ProdutoInsumoRow[];
  abasDetectadas: string[];
  abasFaltantes: string[];
}

// ======================== PARSE ========================

export async function parseConciliacaoWorkbook(file: File): Promise<ConciliacaoBundle> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  await XLSX.ensureLoaded(wb);

  const map = {
    CR: findSheet(wb, ["CR", "Contas a Receber"]),
    CP: findSheet(wb, ["CP", "Contas a Pagar"]),
    FC: findSheet(wb, ["FC", "Fluxo de Caixa"]),
    FOPAG: findSheet(wb, ["FOPAG", "Folha de Pagamento", "Folha"]),
    CLIENTES: findSheet(wb, ["CLIENTES"]),
    FORNECEDORES: findSheet(wb, ["FORNECEDORES"]),
    PLANO: findSheet(wb, ["Plano de Contas", "PlanoContas"]),
    CC: findSheet(wb, ["Centro de Custo", "CentroCusto"]),
    PRODUTOS: findSheet(wb, ["PRODUTOS", "Produtos", "Produtos e Insumos"]),
    INSUMOS: findSheet(wb, ["INSUMOS", "Insumos"]),
  };

  const abasDetectadas: string[] = [];
  const abasFaltantes: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (v) abasDetectadas.push(`${k}:${v}`);
    else abasFaltantes.push(k);
  }

  return {
    cr: map.CR ? parseCROrCP(wb, map.CR, "CR") : [],
    cp: map.CP ? parseCROrCP(wb, map.CP, "CP") : [],
    fopag: map.FOPAG ? parseFopag(wb, map.FOPAG) : [],
    fc: map.FC ? parseFC(wb, map.FC) : [],
    planoContas: map.PLANO ? parsePlanoContas(wb, map.PLANO) : [],
    centroCusto: map.CC ? parseCentroCusto(wb, map.CC) : [],
    clientes: map.CLIENTES ? parsePessoasAux(wb, map.CLIENTES) : [],
    fornecedores: map.FORNECEDORES ? parsePessoasAux(wb, map.FORNECEDORES) : [],
    produtos: map.PRODUTOS ? parseProdutosOuInsumos(wb, map.PRODUTOS, "produto") : [],
    insumos: map.INSUMOS ? parseProdutosOuInsumos(wb, map.INSUMOS, "insumo") : [],
    abasDetectadas,
    abasFaltantes,
  };
}

function parseCROrCP(
  wb: XLSX.WorkBook,
  sheetName: string,
  origem: "CR" | "CP",
): FinanceiroConciliacaoRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  const tipo: "receber" | "pagar" = origem === "CR" ? "receber" : "pagar";

  return rows.map((row, idx) => {
    const emissao = parseDateFlexible(pick(row, "Emissão", "Emissao")).value;
    const vencto = parseDateFlexible(pick(row, "Vencto", "Vencimento", "Data Vencimento")).value;
    const pagto = parseDateFlexible(pick(row, "Data Pagto", "Data Pagamento")).value;
    const valor = parseDecimalFlexible(pick(row, "Valor Pagamento", "Valor")).value || 0;

    const titulo = (() => {
      const v = pick(row, "Título", "Titulo");
      if (v === null || v === undefined || v === "") return null;
      // Pode vir como número
      return String(v).trim() || null;
    })();

    const parcelaRaw = pick(row, "Parcela");
    let parcelaNum: number | null = null;
    let parcelaTotal: number | null = null;
    if (parcelaRaw) {
      // Pode vir como Date (planilha tem datas malucas como parcela), texto, etc.
      const s = String(parcelaRaw);
      const m = s.match(/(\d+)\s*[/-]\s*(\d+)/);
      if (m) {
        parcelaNum = parseInt(m[1]);
        parcelaTotal = parseInt(m[2]);
      } else {
        const n = parseInt(s);
        if (!isNaN(n)) parcelaNum = n;
      }
    }

    const codigoLegado = (() => {
      const v = origem === "CR"
        ? pick(row, "Cod. Cliente", "Cód. Cliente", "Cod Cliente", "Código Cliente")
        : pick(row, "Cod. Fornec", "Cód. Fornec", "Cod Fornec", "Código Fornecedor");
      if (v === null || v === undefined || v === "") return null;
      return String(v).trim();
    })();

    return {
      origem,
      tipo,
      data_emissao: emissao,
      data_vencimento: vencto,
      data_pagamento: pagto,
      valor,
      valor_pago: pagto ? valor : 0,
      descricao: normalizeText(pick(row, "Descrição", "Descricao")),
      titulo,
      parcela_numero: parcelaNum,
      parcela_total: parcelaTotal,
      forma_pagamento: normalizeText(
        pick(row, origem === "CR" ? "Forma de Recebimento" : "Forma de Pagamento", "Forma Pagamento"),
      ) || null,
      banco: normalizeText(pick(row, "Banco")) || null,
      conta_contabil_codigo: normalizeText(pick(row, "Conta Contábil", "Conta Contabil")) || null,
      codigo_legado_pessoa: codigoLegado,
      nome_abreviado: normalizeText(pick(row, "Nome Abreviado")) || null,
      pmv_pmp: parseDecimalFlexible(pick(row, origem === "CR" ? "PMV" : "PMP")).value || null,
      socio: null,
      _originalLine: idx + 2,
      _originalRow: row,
    };
  });
}

function parseFopag(wb: XLSX.WorkBook, sheetName: string): FinanceiroConciliacaoRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  return rows.map((row, idx) => {
    const pagto = parseDateFlexible(pick(row, "Data Pagto", "Data Pagamento")).value;
    const valor = parseDecimalFlexible(pick(row, "Valor Pagamento", "Valor")).value || 0;
    const socio = pick(row, "Sócio", "Socio");
    return {
      origem: "FOPAG",
      tipo: "pagar",
      data_emissao: null,
      data_vencimento: pagto, // FOPAG não tem vencimento separado; usa pagto
      data_pagamento: pagto,
      valor,
      valor_pago: pagto ? valor : 0,
      descricao: normalizeText(pick(row, "Descrição", "Descricao")) || "Folha de pagamento",
      titulo: null,
      parcela_numero: null,
      parcela_total: null,
      forma_pagamento: null,
      banco: null,
      conta_contabil_codigo: normalizeText(pick(row, "Conta Contábil", "Conta Contabil")) || null,
      codigo_legado_pessoa: socio !== null && socio !== "" ? String(socio).trim() : null,
      nome_abreviado: normalizeText(pick(row, "Nome Abreviado")) || null,
      pmv_pmp: null,
      socio: socio !== null && socio !== "" ? String(socio).trim() : null,
      _originalLine: idx + 2,
      _originalRow: row,
    };
  });
}

function parseFC(wb: XLSX.WorkBook, sheetName: string): FCRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  return rows.map((row, idx) => {
    const venc = parseDateFlexible(pick(row, "Vencimento", "Data")).value;
    const tipoRaw = normalizeText(pick(row, "Tipo")) || "";
    const tipoNorm = normHeader(tipoRaw);
    let tipo: "receber" | "pagar" | null = null;
    if (tipoNorm === "CREDITO" || tipoNorm.startsWith("CRED")) tipo = "receber";
    else if (tipoNorm === "DEBITO" || tipoNorm.startsWith("DEB")) tipo = "pagar";

    const cod = pick(row, "Cód. Cliente/Fornecedor", "Cod. Cliente/Fornecedor", "Cod Cliente/Fornecedor");

    return {
      data_vencimento: venc,
      tipo_raw: tipoRaw,
      tipo,
      codigo_pessoa: cod !== null && cod !== "" ? String(cod).trim() : null,
      nome_abreviado: normalizeText(pick(row, "Nome Abreviado")) || null,
      valor: parseDecimalFlexible(pick(row, "Valor")).value || 0,
      status: normalizeText(pick(row, "Status")) || null,
      _originalLine: idx + 2,
    };
  });
}

function parsePlanoContas(wb: XLSX.WorkBook, sheetName: string): PlanoContasRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  const out: PlanoContasRow[] = [];
  rows.forEach((row, idx) => {
    const codigo = normalizeText(pick(row, "Conta Contábil", "Conta Contabil", "Código", "Codigo"));
    const descricao = normalizeText(pick(row, "Descrição", "Descricao"));
    if (!codigo || !descricao) return;
    out.push({
      i_level: normalizeText(pick(row, "i-Level", "iLevel", "Nivel", "Level")) || null,
      codigo,
      descricao,
      _originalLine: idx + 2,
    });
  });
  return out;
}

function parseCentroCusto(wb: XLSX.WorkBook, sheetName: string): CentroCustoRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  const out: CentroCustoRow[] = [];
  rows.forEach((row, idx) => {
    const codigo = normalizeText(pick(row, "Centro de Custo", "Codigo", "Código"));
    const descricao = normalizeText(pick(row, "Descrição", "Descricao"));
    if (!codigo) return;
    out.push({
      codigo,
      descricao,
      responsavel: normalizeText(pick(row, "Responsável", "Responsavel")) || null,
      _originalLine: idx + 2,
    });
  });
  return out;
}

function parsePessoasAux(wb: XLSX.WorkBook, sheetName: string): PessoaAuxRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  const out: PessoaAuxRow[] = [];
  rows.forEach((row, idx) => {
    const cpfCnpj = normalizeCpfCnpj(pick(row, "CNPJ/CPF", "CPF/CNPJ", "CPF", "CNPJ"));
    const codigo = (() => {
      const v = pick(row, "COD.", "Cod.", "Código", "Codigo");
      return v !== null && v !== "" ? String(v).trim() : "";
    })();
    const nome = normalizeText(pick(row, "Cliente", "Fornecedor", "Nome", "Razão Social"));
    if (!nome && !cpfCnpj && !codigo) return;
    const cep = pick(row, "CEP");
    out.push({
      tipo_pessoa: detectTipoPessoa(cpfCnpj),
      cpf_cnpj: cpfCnpj,
      codigo_legado: codigo,
      nome_razao_social: nome,
      nome_fantasia: normalizeText(pick(row, "Fantasia", "Nome Fantasia")) || null,
      inscricao_estadual: normalizeText(pick(row, "IE", "Inscrição Estadual")) || null,
      contato: normalizeText(pick(row, "Contato", "Pessoa de Contato")) || null,
      email: normalizeEmail(pick(row, "Email", "E-mail")) || null,
      telefone: normalizePhone(pick(row, "Fone", "Telefone")) || null,
      celular: normalizePhone(pick(row, "Celular", "Whatsapp")) || null,
      cep: cep !== null && cep !== "" ? normalizeCep(cep) : null,
      logradouro: normalizeText(pick(row, "Endereço", "Endereco", "Logradouro")) || null,
      numero: (() => { const v = pick(row, "Número", "Numero"); return v !== null && v !== "" ? String(v).trim() : null; })(),
      complemento: normalizeText(pick(row, "Complemento")) || null,
      bairro: normalizeText(pick(row, "Bairro")) || null,
      cidade: normalizeText(pick(row, "Cidade")) || null,
      uf: normalizeText(pick(row, "UF", "Estado")) || null,
      caixa_postal: normalizeText(pick(row, "Caixa Postal")) || null,
      observacoes: normalizeText(pick(row, "Obs.", "Observações")) || null,
      prazo_padrao: parsePrazoPadrao(pick(row, "Pagt.", "Pagto", "Prazo")),
      forma_pagamento_padrao: normalizeText(pick(row, "Pagt.", "Pagto", "Forma Pagamento")) || null,
      _originalLine: idx + 2,
    });
  });
  return out;
}

function parseProdutosOuInsumos(
  wb: XLSX.WorkBook,
  sheetName: string,
  tipo: "produto" | "insumo",
): ProdutoInsumoRow[] {
  const rows = readSheetAsObjects(wb, sheetName);
  const out: ProdutoInsumoRow[] = [];
  rows.forEach((row, idx) => {
    const codigo = (() => {
      const v = pick(row, "COD.", "Cod.", "Código", "Codigo");
      return v !== null && v !== "" ? String(v).trim() : "";
    })();
    const nome = normalizeText(pick(row, "Nome", "Descrição"));
    if (!codigo && !nome) return;
    const unidade = (normalizeText(pick(row, "UN", "Unidade")) || "UN").toUpperCase();
    const fornCodigo = (() => {
      const v = pick(row, "COD. FORNECEDOR", "Cod. Fornecedor", "Código Fornecedor");
      return v !== null && v !== "" ? String(v).trim() : null;
    })();
    out.push({
      tipo_item: tipo,
      codigo_legado: codigo,
      sku: codigo,
      nome,
      grupo_nome: normalizeText(pick(row, "GRUPO", "Grupo")) || null,
      unidade_medida: unidade,
      variacoes: normalizeText(pick(row, "VARIAÇÕES", "Variações")) || null,
      preco_custo: parseDecimalFlexible(pick(row, "Custo", "Preço de Custo")).value || 0,
      preco_venda: parseDecimalFlexible(pick(row, "Preço", "Preco")).value || 0,
      peso: parseDecimalFlexible(pick(row, "PESO", "Peso")).value || 0,
      ncm: "84369100",
      estoque_inicial: parseDecimalFlexible(pick(row, "ESTOQUE", "Estoque")).value || 0,
      fornecedor_principal_nome: normalizeText(pick(row, "Fornecedor")) || null,
      fornecedor_principal_legado: fornCodigo,
      ref_fornecedor: normalizeText(pick(row, "REF. FORNECEDOR", "Ref. Fornecedor")) || null,
      url_produto_fornecedor: normalizeText(pick(row, "SITE PRODUTO FORNECEDOR:", "Site Produto Fornecedor")) || null,
      _originalLine: idx + 2,
    });
  });
  return out;
}
