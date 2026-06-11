/**
 * Geração client-side de DANFE (Documento Auxiliar da NF-e) em PDF.
 *
 * Não pretende reproduzir 100% do layout oficial da SEFAZ (que exige código
 * de barras CODE-128C e seções específicas), mas cobre os campos obrigatórios
 * para distribuição operacional ao destinatário enquanto a integração SEFAZ
 * de produção amadurece.
 *
 * Quando a NF está autorizada (`status_sefaz = "autorizada"`) o PDF inclui o
 * protocolo de autorização e a chave de acesso formatada — caso contrário,
 * o documento é marcado como "SEM VALOR FISCAL".
 */

// jspdf e jsbarcode são pesados (~200KB) — carregados sob demanda
// dentro de gerarDanfePdf via dynamic import.
import type { jsPDF as JsPDFType } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export interface DanfeItemInput {
  descricao: string;
  codigo?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  unidade?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
  cst?: string | null;
  base_icms?: number;
  valor_icms?: number;
  aliquota_icms?: number;
  valor_ipi?: number;
  aliquota_ipi?: number;
}

export interface DanfeEmpresaInput {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cnae?: string | null;
  crt?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  numero_endereco?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  pais?: string | null;
}

export interface DanfeParceiroInput {
  nome: string;
  cpf_cnpj?: string | null;
  inscricao_estadual?: string | null;
  indicador_ie?: string | null;
  email?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  numero_endereco?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  pais?: string | null;
}

export interface DanfeTransportadorInput {
  razao_social?: string | null;
  cnpj_cpf?: string | null;
  inscricao_estadual?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  antt?: string | null;
  placa?: string | null;
  uf_placa?: string | null;
}

export interface DanfeVolumeInput {
  quantidade: number;
  especie?: string | null;
  marca?: string | null;
  numero?: string | null;
  peso_liquido?: number;
  peso_bruto?: number;
}

export interface DanfeDuplicataInput {
  numero?: string | null;
  vencimento?: string | null;
  valor: number;
}

export interface DanfePagamentoInput {
  forma?: string | null;
  valor: number;
}

export interface DanfeFaturaInput {
  numero?: string | null;
  valor_original?: number;
  valor_desconto?: number;
  valor_liquido?: number;
}

export interface DanfeInput {
  numero: string;
  serie?: string | null;
  modelo?: string | null;
  data_emissao: string;
  data_saida_entrada?: string | null;
  natureza_operacao?: string | null;
  tipo: "entrada" | "saida";
  chave_acesso?: string | null;
  protocolo_autorizacao?: string | null;
  /** Data/hora de autorização (dhRecbto do protNFe). ISO string. */
  protocolo_data?: string | null;
  status_sefaz?: string | null;
  ambiente_emissao?: string | null;
  /** Indicador de presença do comprador (ide/indPres). */
  indicador_presenca?: string | null;
  /** Operação com consumidor final (ide/indFinal). "0" não, "1" sim. */
  indicador_final?: string | null;
  /** Tipo de emissão (ide/tpEmis). 1=normal, etc. */
  tipo_emissao?: string | null;
  /** Finalidade da emissão (ide/finNFe). 1=normal, 2=complementar, 3=ajuste, 4=devolução. */
  finalidade_emissao?: string | null;
  /** UF do emitente (ide/cUF code ou enderEmit/UF). */
  uf_emissao?: string | null;
  emitente: DanfeEmpresaInput;
  destinatario: DanfeParceiroInput;
  transportador?: DanfeTransportadorInput;
  modalidade_frete?: string | null;
  fatura?: DanfeFaturaInput;
  duplicatas?: DanfeDuplicataInput[];
  pagamentos?: DanfePagamentoInput[];
  volumes?: DanfeVolumeInput[];
  itens: DanfeItemInput[];
  base_icms?: number;
  base_icms_st?: number;
  valor_produtos?: number;
  frete_valor?: number;
  valor_seguro?: number;
  desconto_valor?: number;
  outras_despesas?: number;
  valor_ii?: number;
  valor_fcp?: number;
  icms_valor?: number;
  icms_st_valor?: number;
  ipi_valor?: number;
  pis_valor?: number;
  cofins_valor?: number;
  valor_total_tributos?: number;
  valor_total: number;
  observacoes?: string | null;
  info_fisco?: string | null;
}

function formatarChave(chave: string): string {
  return chave.replace(/\D/g, "").match(/.{1,4}/g)?.join(" ") ?? chave;
}

/**
 * Gera CODE-128C da chave de acesso (44 dígitos) usando jsbarcode em
 * canvas off-screen e devolve o dataURL para `addImage`.
 * Retorna `null` se o ambiente não suportar canvas (SSR).
 */
type JsBarcodeFn = (
  canvas: HTMLCanvasElement,
  text: string,
  options?: Record<string, unknown>,
) => void;

function gerarBarcodeChave(chave: string, JsBarcode: JsBarcodeFn): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, chave.replace(/\D/g, ""), {
      format: "CODE128C",
      displayValue: false,
      margin: 0,
      height: 40,
      width: 1.4,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function safe(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

/**
 * Gera o PDF da DANFE em vetor (sem rasterização) com layout fiel ao modelo
 * SEFAZ/TOTVS — alinhamento em grid uniforme, A4 retrato.
 */
export async function gerarDanfePdf(data: DanfeInput, salvar = true): Promise<Blob> {
  const [{ jsPDF }, { default: JsBarcode }] = await Promise.all([
    import("jspdf"),
    import("jsbarcode"),
  ]);
  const doc: JsPDFType = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 6; // margem externa em mm
  const W = pageW - M * 2;
  let y = M;

  const autorizada = data.status_sefaz === "autorizada";
  const homologacao = data.ambiente_emissao === "homologacao" || data.ambiente_emissao === "2";
  const resumo = data.status_sefaz === "resumo";

  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);

  // helpers ───────────────────────────────────────────────────────────────
  const cell = (
    x: number, yPos: number, w: number, h: number,
    title: string, value: string,
    opts: { valueBold?: boolean; valueAlign?: "left" | "right" | "center"; valueSize?: number; titleSize?: number; valuePadTop?: number } = {},
  ) => {
    doc.rect(x, yPos, w, h);
    if (title) {
      doc.setFont("helvetica", "normal").setFontSize(opts.titleSize ?? 5.5);
      doc.text(title, x + 0.8, yPos + 1.8);
    }
    if (value !== undefined && value !== null) {
      doc.setFont("helvetica", opts.valueBold ? "bold" : "normal").setFontSize(opts.valueSize ?? 8);
      const padTop = opts.valuePadTop ?? (title ? 4.5 : 3);
      const align = opts.valueAlign ?? "left";
      const xText = align === "right" ? x + w - 0.8 : align === "center" ? x + w / 2 : x + 0.8;
      doc.text(value, xText, yPos + padTop, { align });
    }
  };

  const ensure = (need: number) => {
    if (y + need > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  // Recibo do destinatário ───────────────────────────────────────────────
  const reciboH = 12;
  const lateralW = 55;
  doc.rect(M, y, W - lateralW, reciboH / 2);
  doc.setFont("helvetica", "normal").setFontSize(5.5);
  doc.text(
    `RECEBEMOS DE ${safe(data.emitente.razao_social).toUpperCase()} OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`,
    M + 1, y + 2,
  );
  doc.text(
    `Emissão: ${formatDate(data.data_emissao)}  ·  Valor Total: R$ ${formatCurrency(data.valor_total ?? 0)}  ·  Destinatário: ${safe(data.destinatario.nome).slice(0, 60)}`,
    M + 1, y + 4.5,
  );
  // sub-linha "data recebimento | assinatura"
  doc.rect(M, y + reciboH / 2, (W - lateralW) * 0.3, reciboH / 2);
  doc.text("DATA DE RECEBIMENTO", M + 1, y + reciboH / 2 + 2);
  doc.rect(M + (W - lateralW) * 0.3, y + reciboH / 2, (W - lateralW) * 0.7, reciboH / 2);
  doc.text("IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", M + (W - lateralW) * 0.3 + 1, y + reciboH / 2 + 2);
  // Lateral NF-e nº/série
  doc.rect(M + W - lateralW, y, lateralW, reciboH);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("NF-e", M + W - lateralW + lateralW / 2, y + 4, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Nº ${safe(data.numero)}`, M + W - lateralW + lateralW / 2, y + 8, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Série ${safe(data.serie, "1")}`, M + W - lateralW + lateralW / 2, y + 11, { align: "center" });
  y += reciboH + 1;

  // Cabeçalho: emitente | DANFE | barcode/chave ──────────────────────────
  const headerH = 30;
  const colA = W * 0.4;
  const colB = W * 0.2;
  const colC = W - colA - colB;

  // A: emitente
  doc.rect(M, y, colA, headerH);
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(safe(data.emitente.razao_social), M + colA / 2, y + 5, { align: "center", maxWidth: colA - 4 });
  doc.setFont("helvetica", "normal").setFontSize(7);
  const enderLinhas: string[] = [];
  if (data.emitente.endereco) enderLinhas.push(data.emitente.endereco);
  const munLine = [data.emitente.cidade, data.emitente.uf].filter(Boolean).join(" - ");
  if (munLine || data.emitente.cep) enderLinhas.push(`${munLine}${data.emitente.cep ? ` · CEP ${data.emitente.cep}` : ""}`);
  if (data.emitente.telefone) enderLinhas.push(`Fone: ${data.emitente.telefone}`);
  if (data.emitente.nome_fantasia) enderLinhas.push(data.emitente.nome_fantasia);
  doc.text(enderLinhas, M + colA / 2, y + 10, { align: "center", maxWidth: colA - 4 });

  // B: DANFE label
  doc.rect(M + colA, y, colB, headerH);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("DANFE", M + colA + colB / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(6.5);
  doc.text("Documento Auxiliar da", M + colA + colB / 2, y + 9, { align: "center" });
  doc.text("Nota Fiscal Eletrônica", M + colA + colB / 2, y + 11.5, { align: "center" });
  doc.setFontSize(7);
  doc.text("0 - ENTRADA", M + colA + 4, y + 16);
  doc.text("1 - SAÍDA", M + colA + colB - 4, y + 16, { align: "right" });
  doc.rect(M + colA + colB / 2 - 3, y + 17, 6, 4);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(data.tipo === "entrada" ? "0" : "1", M + colA + colB / 2, y + 20, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Nº ${safe(data.numero)}`, M + colA + colB / 2, y + 24, { align: "center" });
  doc.setFontSize(7);
  doc.text(`SÉRIE: ${safe(data.serie, "1")}`, M + colA + colB / 2, y + 26.5, { align: "center" });
  doc.text("FOLHA 1/1", M + colA + colB / 2, y + 28.5, { align: "center" });

  // C: chave + barcode
  doc.rect(M + colA + colB, y, colC, headerH);
  if (data.chave_acesso) {
    const bc = gerarBarcodeChave(data.chave_acesso, JsBarcode);
    if (bc) {
      doc.addImage(bc, "PNG", M + colA + colB + 2, y + 2, colC - 4, 12);
    }
    doc.setFont("helvetica", "bold").setFontSize(5.5);
    doc.text("CHAVE DE ACESSO", M + colA + colB + 2, y + 16);
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.text(formatarChave(data.chave_acesso), M + colA + colB + colC / 2, y + 19, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(5.5);
    doc.text(
      "Consulta de autenticidade no portal nacional da NF-e",
      M + colA + colB + colC / 2, y + 22.5, { align: "center" },
    );
    doc.text(
      "www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora",
      M + colA + colB + colC / 2, y + 24.5, { align: "center" },
    );
  }
  y += headerH;

  // Natureza / Protocolo ────────────────────────────────────────────────
  cell(M, y, W * 0.6, 8, "NATUREZA DA OPERAÇÃO", safe(data.natureza_operacao));
  cell(M + W * 0.6, y, W * 0.4, 8, "PROTOCOLO DE AUTORIZAÇÃO DE USO",
    data.protocolo_autorizacao
      ? `${data.protocolo_autorizacao} - ${formatDate(data.data_emissao)}`
      : "—");
  y += 8;

  // IE | IE ST | CNPJ
  cell(M, y, W / 3, 8, "INSCRIÇÃO ESTADUAL", safe(data.emitente.inscricao_estadual));
  cell(M + W / 3, y, W / 3, 8, "INSC. ESTADUAL DO SUBST. TRIB.", "—");
  cell(M + (W / 3) * 2, y, W / 3, 8, "CNPJ", safe(data.emitente.cnpj));
  y += 8;

  // Banner ambiente/resumo ──────────────────────────────────────────────
  if (homologacao || !autorizada || resumo) {
    doc.setFillColor(homologacao ? 255 : 255, homologacao ? 240 : 220, homologacao ? 200 : 220);
    doc.rect(M, y, W, 5, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(homologacao ? 150 : 180, homologacao ? 80 : 0, 0);
    const banner = resumo
      ? "SOMENTE RESUMO — DETALHES INDISPONÍVEIS (APLIQUE CIÊNCIA PARA RECEBER O XML COMPLETO)"
      : homologacao
        ? "AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL"
        : "DOCUMENTO NÃO AUTORIZADO PELA SEFAZ — SEM VALOR FISCAL";
    doc.text(banner, M + W / 2, y + 3.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // Destinatário ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(6).text("DESTINATÁRIO / REMETENTE", M, y - 0.5);
  // linha 1: nome | CNPJ | DATA EMISSÃO
  cell(M, y, W * 0.55, 7, "NOME / RAZÃO SOCIAL", safe(data.destinatario.nome));
  cell(M + W * 0.55, y, W * 0.25, 7, "CNPJ / CPF", safe(data.destinatario.cpf_cnpj));
  cell(M + W * 0.8, y, W * 0.2, 7, "DATA DE EMISSÃO", formatDate(data.data_emissao));
  y += 7;
  // linha 2: endereço | bairro | CEP | DATA SAÍDA
  cell(M, y, W * 0.45, 7, "ENDEREÇO", safe(data.destinatario.endereco));
  cell(M + W * 0.45, y, W * 0.2, 7, "BAIRRO / DISTRITO", safe(data.destinatario.bairro));
  cell(M + W * 0.65, y, W * 0.15, 7, "CEP", safe(data.destinatario.cep));
  cell(M + W * 0.8, y, W * 0.2, 7, "DATA SAÍDA / ENTRADA", data.data_saida_entrada ? formatDate(data.data_saida_entrada) : "—");
  y += 7;
  // linha 3: município | UF | fone | IE | indIE
  cell(M, y, W * 0.45, 7, "MUNICÍPIO", safe(data.destinatario.cidade));
  cell(M + W * 0.45, y, W * 0.07, 7, "UF", safe(data.destinatario.uf), { valueAlign: "center" });
  cell(M + W * 0.52, y, W * 0.18, 7, "FONE / FAX", safe(data.destinatario.telefone));
  cell(M + W * 0.7, y, W * 0.2, 7, "INSCRIÇÃO ESTADUAL", safe(data.destinatario.inscricao_estadual));
  cell(M + W * 0.9, y, W * 0.1, 7, "IND. IE", safe(data.destinatario.indicador_ie), { valueAlign: "center" });
  y += 7;

  // Fatura/Duplicatas ────────────────────────────────────────────────────
  const dups = data.duplicatas ?? [];
  if (dups.length > 0) {
    doc.setFont("helvetica", "bold").setFontSize(6).text("FATURA / DUPLICATAS", M, y - 0.5);
    const dupW = W / 3;
    const linhasDup = Math.ceil(dups.length / 3);
    for (let i = 0; i < dups.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const d = dups[i];
      cell(M + col * dupW, y + row * 7, dupW, 7,
        `DUP. ${d.numero ?? i + 1}`,
        `Venc: ${d.vencimento ? formatDate(d.vencimento) : "—"}  ·  R$ ${formatCurrency(d.valor)}`,
        { valueSize: 7 });
    }
    y += linhasDup * 7;
  }

  // Cálculo do imposto ───────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(6).text("CÁLCULO DO IMPOSTO", M, y - 0.5);
  const l1: Array<[string, string]> = [
    ["BASE DE CÁLC. ICMS", formatCurrency(data.base_icms ?? 0)],
    ["VALOR DO ICMS", formatCurrency(data.icms_valor ?? 0)],
    ["BASE CÁLC. ICMS ST", formatCurrency(data.base_icms_st ?? 0)],
    ["VALOR ICMS ST", formatCurrency(data.icms_st_valor ?? 0)],
    ["V. IMP. IMPORTAÇÃO", formatCurrency(data.valor_ii ?? 0)],
    ["VALOR FCP", formatCurrency(data.valor_fcp ?? 0)],
    ["VALOR DO PIS", formatCurrency(data.pis_valor ?? 0)],
    ["V. TOTAL PRODUTOS", formatCurrency(data.valor_produtos ?? 0)],
  ];
  const colL1 = W / l1.length;
  l1.forEach(([t, v], i) => cell(M + i * colL1, y, colL1, 8, t, v, { valueAlign: "right", valueSize: 7 }));
  y += 8;
  const l2: Array<[string, string, boolean?]> = [
    ["VALOR DO FRETE", formatCurrency(data.frete_valor ?? 0)],
    ["VALOR DO SEGURO", formatCurrency(data.valor_seguro ?? 0)],
    ["DESCONTO", formatCurrency(data.desconto_valor ?? 0)],
    ["OUTRAS DESPESAS", formatCurrency(data.outras_despesas ?? 0)],
    ["VALOR DO IPI", formatCurrency(data.ipi_valor ?? 0)],
    ["V. APROX. TRIBUTOS", formatCurrency(data.valor_total_tributos ?? 0)],
    ["VALOR DA COFINS", formatCurrency(data.cofins_valor ?? 0)],
    ["V. TOTAL DA NOTA", formatCurrency(data.valor_total), true],
  ];
  const colL2 = W / l2.length;
  l2.forEach(([t, v, bold], i) =>
    cell(M + i * colL2, y, colL2, 8, t, v, { valueAlign: "right", valueSize: bold ? 9 : 7, valueBold: !!bold }));
  y += 8;

  // Transportador / Volumes ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(6).text("TRANSPORTADOR / VOLUMES TRANSPORTADOS", M, y - 0.5);
  const t = data.transportador ?? {};
  const fretePor = FRETE_LABEL_MAP[data.modalidade_frete ?? "9"] ?? "9 - Sem frete";
  cell(M, y, W * 0.35, 7, "RAZÃO SOCIAL", safe(t.razao_social));
  cell(M + W * 0.35, y, W * 0.15, 7, "FRETE POR CONTA", fretePor, { valueSize: 6.5 });
  cell(M + W * 0.5, y, W * 0.12, 7, "CÓD. ANTT", safe(t.antt));
  cell(M + W * 0.62, y, W * 0.13, 7, "PLACA", safe(t.placa));
  cell(M + W * 0.75, y, W * 0.07, 7, "UF", safe(t.uf_placa), { valueAlign: "center" });
  cell(M + W * 0.82, y, W * 0.18, 7, "CNPJ / CPF", safe(t.cnpj_cpf));
  y += 7;
  cell(M, y, W * 0.45, 7, "ENDEREÇO", safe(t.endereco));
  cell(M + W * 0.45, y, W * 0.3, 7, "MUNICÍPIO", safe(t.cidade));
  cell(M + W * 0.75, y, W * 0.07, 7, "UF", safe(t.uf), { valueAlign: "center" });
  cell(M + W * 0.82, y, W * 0.18, 7, "INSCRIÇÃO ESTADUAL", safe(t.inscricao_estadual));
  y += 7;
  // volumes
  const vols = data.volumes ?? [];
  const v0 = vols[0] ?? { quantidade: 0 };
  cell(M, y, W * 0.1, 7, "QTD.", v0.quantidade ? String(v0.quantidade) : "—", { valueAlign: "right" });
  cell(M + W * 0.1, y, W * 0.2, 7, "ESPÉCIE", safe(v0.especie));
  cell(M + W * 0.3, y, W * 0.15, 7, "MARCA", safe(v0.marca));
  cell(M + W * 0.45, y, W * 0.15, 7, "NUMERAÇÃO", safe(v0.numero));
  cell(M + W * 0.6, y, W * 0.2, 7, "PESO BRUTO", v0.peso_bruto ? formatCurrency(v0.peso_bruto) : "—", { valueAlign: "right" });
  cell(M + W * 0.8, y, W * 0.2, 7, "PESO LÍQUIDO", v0.peso_liquido ? formatCurrency(v0.peso_liquido) : "—", { valueAlign: "right" });
  y += 7;

  // Produtos ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(6).text("DADOS DO PRODUTO / SERVIÇO", M, y - 0.5);
  const cols: Array<{ label: string; w: number; align?: "left" | "right" | "center" }> = [
    { label: "CÓDIGO", w: W * 0.08 },
    { label: "DESCRIÇÃO DO PRODUTO / SERVIÇO", w: W * 0.30 },
    { label: "NCM/SH", w: W * 0.06, align: "center" },
    { label: "CST", w: W * 0.04, align: "center" },
    { label: "CFOP", w: W * 0.05, align: "center" },
    { label: "UN", w: W * 0.04, align: "center" },
    { label: "QTD.", w: W * 0.07, align: "right" },
    { label: "V.UNIT.", w: W * 0.07, align: "right" },
    { label: "V.TOTAL", w: W * 0.08, align: "right" },
    { label: "B.CÁLC ICMS", w: W * 0.07, align: "right" },
    { label: "V.ICMS", w: W * 0.06, align: "right" },
    { label: "V.IPI", w: W * 0.04, align: "right" },
    { label: "%ICMS", w: W * 0.02, align: "right" },
    { label: "%IPI", w: W * 0.02, align: "right" },
  ];
  // soma normaliza para 100% de W
  const colSum = cols.reduce((s, c) => s + c.w, 0);
  const scale = W / colSum;
  cols.forEach((c) => (c.w *= scale));

  const drawProdHeader = () => {
    doc.setFillColor(230, 230, 230);
    doc.rect(M, y, W, 5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(5.5);
    let xx = M;
    for (const c of cols) {
      doc.text(c.label, c.align === "right" ? xx + c.w - 0.6 : c.align === "center" ? xx + c.w / 2 : xx + 0.6,
        y + 3.2, { align: c.align ?? "left" });
      // separadores verticais
      doc.line(xx, y, xx, y + 5);
      xx += c.w;
    }
    doc.line(M + W, y, M + W, y + 5);
    y += 5;
  };
  drawProdHeader();

  doc.setFont("helvetica", "normal").setFontSize(6.5);
  for (const item of data.itens) {
    const desc = item.descricao || "—";
    const linhas = doc.splitTextToSize(desc, cols[1].w - 1) as string[];
    const rowH = Math.max(4, linhas.length * 3 + 1);
    if (y + rowH > pageH - M - 35) {
      doc.addPage();
      y = M;
      drawProdHeader();
    }
    // grid
    let xx = M;
    for (const c of cols) {
      doc.rect(xx, y, c.w, rowH);
      xx += c.w;
    }
    const total = item.valor_total ?? item.quantidade * item.valor_unitario;
    const vals: string[] = [
      safe(item.codigo, ""),
      "", // descrição: tratada separado (multiline)
      safe(item.ncm, ""),
      safe(item.cst, ""),
      safe(item.cfop, ""),
      safe(item.unidade, ""),
      item.quantidade ? item.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : "",
      formatCurrency(item.valor_unitario),
      formatCurrency(total),
      formatCurrency(item.base_icms ?? 0),
      formatCurrency(item.valor_icms ?? 0),
      formatCurrency(item.valor_ipi ?? 0),
      item.aliquota_icms ? String(item.aliquota_icms) : "",
      item.aliquota_ipi ? String(item.aliquota_ipi) : "",
    ];
    xx = M;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (i === 1) {
        doc.text(linhas, xx + 0.6, y + 3);
      } else {
        doc.text(
          vals[i],
          c.align === "right" ? xx + c.w - 0.6 : c.align === "center" ? xx + c.w / 2 : xx + 0.6,
          y + 3,
          { align: c.align ?? "left" },
        );
      }
      xx += c.w;
    }
    y += rowH;
  }

  // Dados adicionais ─────────────────────────────────────────────────────
  ensure(35);
  doc.setFont("helvetica", "bold").setFontSize(6).text("DADOS ADICIONAIS", M, y + 1);
  y += 2;
  const adW = W * 0.7;
  const fiscoW = W - adW;
  const adH = 30;
  doc.rect(M, y, adW, adH);
  doc.rect(M + adW, y, fiscoW, adH);
  doc.setFont("helvetica", "normal").setFontSize(5.5);
  doc.text("INFORMAÇÕES COMPLEMENTARES", M + 0.8, y + 2);
  doc.text("RESERVADO AO FISCO", M + adW + 0.8, y + 2);
  doc.setFontSize(6.5);
  if (data.observacoes) {
    const obsLines = doc.splitTextToSize(data.observacoes, adW - 2) as string[];
    doc.text(obsLines.slice(0, 12), M + 0.8, y + 5);
  }
  if (data.info_fisco) {
    const inf = doc.splitTextToSize(data.info_fisco, fiscoW - 2) as string[];
    doc.text(inf.slice(0, 12), M + adW + 0.8, y + 5);
  }
  y += adH;

  const blob = doc.output("blob");
  if (salvar) {
    doc.save(`DANFE-${data.numero}-serie${data.serie ?? "1"}.pdf`);
  }
  return blob;
}

const FRETE_LABEL_MAP: Record<string, string> = {
  "0": "0 - Emitente",
  "1": "1 - Destinatário",
  "2": "2 - Terceiros",
  "3": "3 - Próprio rem.",
  "4": "4 - Próprio dest.",
  "9": "9 - Sem frete",
};

// ───────────────────── Consulta DANFE por chave (proxy) ───────────────────────

export interface DanfeConsultaResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

/**
 * Consulta a NF-e por chave usando a edge `consultadanfe-proxy` (API de
 * fallback paga). O caller decide o que fazer com o payload (extrair XML,
 * mensagem de erro, etc.).
 */
export async function consultarDanfePorChave(
  chave: string,
): Promise<DanfeConsultaResult> {
  const { data, error } = await supabase.functions.invoke("consultadanfe-proxy", {
    body: { action: "consulta", chave },
  });
  if (error) {
    throw new Error(error.message ?? "Falha ao chamar API de fallback.");
  }
  return (data ?? { ok: false }) as DanfeConsultaResult;
}