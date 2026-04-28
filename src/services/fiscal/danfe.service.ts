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

import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { formatCurrency, formatDate } from "@/lib/format";

export interface DanfeItemInput {
  descricao: string;
  codigo?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  unidade?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
}

export interface DanfeEmpresaInput {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
}

export interface DanfeParceiroInput {
  nome: string;
  cpf_cnpj?: string | null;
  inscricao_estadual?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface DanfeInput {
  numero: string;
  serie?: string | null;
  modelo?: string | null;
  data_emissao: string;
  natureza_operacao?: string | null;
  tipo: "entrada" | "saida";
  chave_acesso?: string | null;
  protocolo_autorizacao?: string | null;
  status_sefaz?: string | null;
  ambiente_emissao?: string | null;
  emitente: DanfeEmpresaInput;
  destinatario: DanfeParceiroInput;
  itens: DanfeItemInput[];
  valor_produtos?: number;
  frete_valor?: number;
  desconto_valor?: number;
  outras_despesas?: number;
  icms_valor?: number;
  icms_st_valor?: number;
  ipi_valor?: number;
  pis_valor?: number;
  cofins_valor?: number;
  valor_total: number;
  observacoes?: string | null;
}

function formatarChave(chave: string): string {
  return chave.replace(/\D/g, "").match(/.{1,4}/g)?.join(" ") ?? chave;
}

/**
 * Gera CODE-128C da chave de acesso (44 dígitos) usando jsbarcode em
 * canvas off-screen e devolve o dataURL para `addImage`.
 * Retorna `null` se o ambiente não suportar canvas (SSR).
 */
function gerarBarcodeChave(chave: string): string | null {
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
 * Gera o PDF da DANFE e retorna o Blob.
 * Use `salvar = true` para disparar download automático.
 */
export function gerarDanfePdf(data: DanfeInput, salvar = true): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  let y = margin;

  const autorizada = data.status_sefaz === "autorizada";
  const homologacao = data.ambiente_emissao === "homologacao" || data.ambiente_emissao === "2";

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageWidth - margin * 2, 28);

  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text(safe(data.emitente.razao_social), margin + 3, y + 6);
  doc.setFontSize(8).setFont("helvetica", "normal");
  if (data.emitente.nome_fantasia) {
    doc.text(safe(data.emitente.nome_fantasia), margin + 3, y + 11);
  }
  doc.text(`CNPJ: ${safe(data.emitente.cnpj)}`, margin + 3, y + 16);
  doc.text(`IE: ${safe(data.emitente.inscricao_estadual)}`, margin + 3, y + 20);
  doc.text(
    [data.emitente.endereco, data.emitente.cidade, data.emitente.uf, data.emitente.cep]
      .filter(Boolean)
      .join(" — "),
    margin + 3,
    y + 24,
  );

  // Bloco "DANFE" à direita
  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text("DANFE", pageWidth - margin - 50, y + 8);
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("Documento Auxiliar da", pageWidth - margin - 50, y + 13);
  doc.text("Nota Fiscal Eletrônica", pageWidth - margin - 50, y + 17);
  doc.text(
    `${data.tipo === "saida" ? "1 - SAÍDA" : "0 - ENTRADA"}`,
    pageWidth - margin - 50,
    y + 22,
  );
  doc.text(`Nº ${safe(data.numero)}  Série ${safe(data.serie, "1")}`, pageWidth - margin - 50, y + 26);

  y += 30;

  // ── Banner ambiente / chave ─────────────────────────────────────────────
  if (homologacao) {
    doc.setFillColor(255, 240, 200);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(150, 80, 0);
    doc.text(
      "AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL",
      pageWidth / 2,
      y + 5,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);
    y += 9;
  } else if (!autorizada) {
    doc.setFillColor(255, 220, 220);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(180, 0, 0);
    doc.text(
      "DOCUMENTO NÃO AUTORIZADO PELA SEFAZ — SEM VALOR FISCAL",
      pageWidth / 2,
      y + 5,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);
    y += 9;
  }

  if (data.chave_acesso) {
    doc.setFontSize(7).setFont("helvetica", "bold");
    doc.text("CHAVE DE ACESSO", margin, y + 4);
    doc.setFont("helvetica", "normal");
    doc.text(formatarChave(data.chave_acesso), margin, y + 8);
    y += 12;
  }

  if (data.protocolo_autorizacao) {
    doc.setFontSize(7).setFont("helvetica", "bold");
    doc.text(
      `PROTOCOLO DE AUTORIZAÇÃO: ${data.protocolo_autorizacao}`,
      margin,
      y + 3,
    );
    y += 6;
  }

  // ── Identificação ───────────────────────────────────────────────────────
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.rect(margin, y, pageWidth - margin * 2, 8);
  doc.text(`NATUREZA DA OPERAÇÃO: ${safe(data.natureza_operacao)}`, margin + 2, y + 5);
  doc.text(`EMISSÃO: ${formatDate(data.data_emissao)}`, pageWidth - margin - 60, y + 5);
  y += 10;

  // ── Destinatário ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("DESTINATÁRIO / REMETENTE", margin, y);
  y += 2;
  doc.rect(margin, y, pageWidth - margin * 2, 16);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`Nome: ${safe(data.destinatario.nome)}`, margin + 2, y + 5);
  doc.text(`CPF/CNPJ: ${safe(data.destinatario.cpf_cnpj)}`, margin + 2, y + 9);
  doc.text(`IE: ${safe(data.destinatario.inscricao_estadual)}`, margin + 80, y + 9);
  doc.text(
    `Endereço: ${[data.destinatario.endereco, data.destinatario.cidade, data.destinatario.uf, data.destinatario.cep].filter(Boolean).join(" — ") || "—"}`,
    margin + 2,
    y + 13,
  );
  y += 18;

  // ── Itens ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("PRODUTOS / SERVIÇOS", margin, y);
  y += 2;

  const colHeaders: Array<[string, number]> = [
    ["Cód.", 20],
    ["Descrição", 80],
    ["NCM", 18],
    ["CFOP", 12],
    ["UN", 10],
    ["Qtd", 14],
    ["V. Unit.", 18],
    ["V. Total", 22],
  ];

  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, pageWidth - margin * 2, 5, "F");
  let x = margin + 1;
  doc.setFontSize(7);
  for (const [label, w] of colHeaders) {
    doc.text(label, x, y + 3.5);
    x += w;
  }
  y += 5;

  doc.setFont("helvetica", "normal");
  for (const item of data.itens) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    const total = item.valor_total ?? item.quantidade * item.valor_unitario;
    x = margin + 1;
    const cells = [
      safe(item.codigo, ""),
      item.descricao.slice(0, 60),
      safe(item.ncm, ""),
      safe(item.cfop, ""),
      safe(item.unidade, ""),
      String(item.quantidade),
      formatCurrency(item.valor_unitario),
      formatCurrency(total),
    ];
    cells.forEach((cell, idx) => {
      doc.text(cell, x, y + 3.5);
      x += colHeaders[idx][1];
    });
    y += 5;
  }

  // ── Totais ──────────────────────────────────────────────────────────────
  if (y > 240) {
    doc.addPage();
    y = margin;
  }
  y += 4;
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("CÁLCULO DO IMPOSTO", margin, y);
  y += 2;
  doc.rect(margin, y, pageWidth - margin * 2, 14);
  doc.setFont("helvetica", "normal").setFontSize(7);

  const totaisLinha1 = [
    ["Base ICMS", formatCurrency(0)],
    ["V. ICMS", formatCurrency(data.icms_valor ?? 0)],
    ["V. ICMS-ST", formatCurrency(data.icms_st_valor ?? 0)],
    ["V. IPI", formatCurrency(data.ipi_valor ?? 0)],
    ["V. PIS", formatCurrency(data.pis_valor ?? 0)],
    ["V. COFINS", formatCurrency(data.cofins_valor ?? 0)],
  ];
  const totaisLinha2 = [
    ["V. Produtos", formatCurrency(data.valor_produtos ?? 0)],
    ["V. Frete", formatCurrency(data.frete_valor ?? 0)],
    ["V. Desconto", formatCurrency(data.desconto_valor ?? 0)],
    ["Outras Desp.", formatCurrency(data.outras_despesas ?? 0)],
    ["V. TOTAL NF", formatCurrency(data.valor_total)],
  ];

  const colW = (pageWidth - margin * 2) / 6;
  totaisLinha1.forEach(([label, val], idx) => {
    doc.setFont("helvetica", "normal").text(label, margin + 2 + idx * colW, y + 4);
    doc.setFont("helvetica", "bold").text(val, margin + 2 + idx * colW, y + 8);
  });
  const colW2 = (pageWidth - margin * 2) / 5;
  totaisLinha2.forEach(([label, val], idx) => {
    doc.setFont("helvetica", "normal").text(label, margin + 2 + idx * colW2, y + 11);
    const isTotal = idx === totaisLinha2.length - 1;
    doc.setFont("helvetica", "bold").setFontSize(isTotal ? 9 : 7);
    doc.text(val, margin + 2 + idx * colW2, y + 14);
    doc.setFontSize(7);
  });

  y += 16;

  // ── Observações ─────────────────────────────────────────────────────────
  if (data.observacoes) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text("INFORMAÇÕES COMPLEMENTARES", margin, y);
    y += 2;
    doc.rect(margin, y, pageWidth - margin * 2, 16);
    doc.setFont("helvetica", "normal");
    const linhas = doc.splitTextToSize(data.observacoes, pageWidth - margin * 2 - 4);
    doc.text(linhas, margin + 2, y + 4);
  }

  const blob = doc.output("blob");
  if (salvar) {
    doc.save(`DANFE-${data.numero}-serie${data.serie ?? "1"}.pdf`);
  }
  return blob;
}