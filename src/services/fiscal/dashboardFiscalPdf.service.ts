/**
 * Exportação do Dashboard Fiscal em PDF (Onda 20).
 *
 * Gera um documento A4 retrato com cabeçalho da empresa, período e seções
 * para Emissão (saída), Recebimento (entrada/DistDF-e), Apuração de tributos,
 * Sincronização DistDF-e e Configuração de emissão.
 *
 * Reusa o padrão jsPDF do `export.service.ts` (helvetica, margens), mas em
 * retrato — o conteúdo é majoritariamente KPI/listas, não tabelar.
 */

import { toast } from "sonner";
import { buildExportFilename } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DashboardFiscalKpis } from "./dashboardFiscal.service";

interface EmpresaHeader {
  razao_social?: string;
  cnpj?: string;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function fetchEmpresaHeader(): Promise<EmpresaHeader | null> {
  const { data } = await supabase
    .from("empresa_config")
    .select("razao_social, cnpj")
    .limit(1)
    .maybeSingle();
  return (data as EmpresaHeader) ?? null;
}

export interface DashboardFiscalPdfOptions {
  data: DashboardFiscalKpis;
  periodo: { from: string; to: string };
}

export async function exportarDashboardFiscalPdf({
  data,
  periodo,
}: DashboardFiscalPdfOptions): Promise<void> {
  if (!data) {
    toast.warning("Sem dados para exportar.");
    return;
  }

  const { default: jsPDF } = await import("jspdf");
  const empresa = await fetchEmpresaHeader();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - 14) {
      doc.addPage();
      y = 16;
    }
  };

  // ── Cabeçalho empresa ─────────────────────────────────────────────────────
  if (empresa?.razao_social) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(empresa.razao_social, margin, y);
    y += 4;
    if (empresa.cnpj) {
      doc.setFont("helvetica", "normal");
      doc.text(`CNPJ: ${empresa.cnpj}`, margin, y);
      y += 4;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  // ── Título ────────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Dashboard Fiscal", margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Período: ${formatDateBr(periodo.from)} a ${formatDateBr(periodo.to)}`,
    margin,
    y,
  );
  y += 4;
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    margin,
    y,
  );
  y += 8;

  // ── Helpers de seção ──────────────────────────────────────────────────────
  const drawSectionTitle = (label: string) => {
    ensureSpace(10);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 6, "F");
    doc.text(label, margin + 2, y);
    y += 7;
  };

  const drawKpiGrid = (items: Array<{ label: string; value: string; sub?: string }>) => {
    const cols = 2;
    const colW = (pageWidth - margin * 2) / cols;
    const rowH = 14;
    for (let i = 0; i < items.length; i += cols) {
      ensureSpace(rowH);
      for (let c = 0; c < cols; c++) {
        const item = items[i + c];
        if (!item) continue;
        const x = margin + c * colW;
        doc.setDrawColor(220, 220, 220);
        doc.rect(x + 1, y - 4, colW - 2, rowH - 2);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(110, 110, 110);
        doc.text(item.label, x + 3, y);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(item.value, x + 3, y + 5);
        if (item.sub) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(110, 110, 110);
          doc.text(item.sub, x + 3, y + 8.5);
        }
      }
      y += rowH;
    }
    doc.setTextColor(0, 0, 0);
    y += 2;
  };

  const drawKeyValueList = (items: Array<{ label: string; value: string }>) => {
    doc.setFontSize(9);
    for (const item of items) {
      ensureSpace(5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text(item.label, margin + 2, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(item.value, pageWidth - margin - 2, y, { align: "right" });
      y += 5;
    }
    doc.setTextColor(0, 0, 0);
    y += 2;
  };

  // ── NF-e Emitidas ─────────────────────────────────────────────────────────
  drawSectionTitle("NF-e Emitidas (saída)");
  drawKpiGrid([
    { label: "Autorizadas", value: String(data.saida.autorizadas), sub: fmtBRL(data.saida.valorAutorizado) },
    { label: "Rejeitadas", value: String(data.saida.rejeitadas) },
    { label: "Canceladas", value: String(data.saida.canceladas) },
    { label: "Pendentes / rascunho", value: String(data.saida.pendentes) },
  ]);

  // ── NF-e Recebidas ────────────────────────────────────────────────────────
  drawSectionTitle("NF-e Recebidas (entrada · DistDF-e)");
  drawKpiGrid([
    { label: "Total recebidas", value: String(data.entrada.total), sub: fmtBRL(data.entrada.valorTotal) },
    { label: "Sem manifestação", value: String(data.entrada.semManifestacao) },
    { label: "Ciência / Confirmadas", value: String(data.entrada.cienciaConfirmada) },
    { label: "Desconhecidas / Não realizadas", value: String(data.entrada.desconhecidaNaoRealizada) },
  ]);

  // ── Tributos ──────────────────────────────────────────────────────────────
  drawSectionTitle("Apuração no período (NF-e autorizadas)");
  drawKeyValueList([
    { label: "ICMS", value: fmtBRL(data.tributos.icms) },
    { label: "ICMS-ST", value: fmtBRL(data.tributos.icmsSt) },
    { label: "IPI", value: fmtBRL(data.tributos.ipi) },
    { label: "PIS", value: fmtBRL(data.tributos.pis) },
    { label: "COFINS", value: fmtBRL(data.tributos.cofins) },
  ]);

  // ── Sincronização DistDF-e ────────────────────────────────────────────────
  drawSectionTitle("Sincronização DistDF-e");
  drawKeyValueList([
    {
      label: "Última execução",
      value: data.sincronizacao.ultimaSyncAt
        ? format(new Date(data.sincronizacao.ultimaSyncAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "—",
    },
    { label: "Último cStat", value: data.sincronizacao.ultimoCStat ?? "—" },
    { label: "CNPJs monitorados", value: String(data.sincronizacao.qtdCnpjs) },
  ]);

  // ── Configuração de emissão ───────────────────────────────────────────────
  drawSectionTitle("Configuração de emissão");
  drawKeyValueList([
    { label: "Ambiente", value: data.empresa.ambiente === "1" ? "Produção" : "Homologação" },
    {
      label: "Próximo nº · série",
      value: `${data.empresa.proximoNumero ?? "—"} · ${data.empresa.serie ?? "—"}`,
    },
    { label: "Modo emissão", value: data.empresa.modoEmissao ?? "normal" },
    { label: "Contingência", value: data.empresa.contingenciaAtiva ? "ATIVA" : "Inativa" },
  ]);

  // ── Movimento diário (resumo top dias) ────────────────────────────────────
  if (data.serieDiaria.length > 0) {
    drawSectionTitle("Movimento diário no período (top 15 dias)");
    const top = [...data.serieDiaria]
      .sort((a, b) => b.emitidas + b.recebidas - (a.emitidas + a.recebidas))
      .slice(0, 15);
    drawKeyValueList(
      top.map((d) => ({
        label: formatDateBr(d.dia),
        value: `Emitidas ${d.emitidas} · Recebidas ${d.recebidas}`,
      })),
    );
  }

  // ── Rodapé com paginação ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    );
    doc.text("AviZee · Dashboard Fiscal", margin, pageHeight - 8);
  }

  const filename = buildExportFilename(
    `dashboard-fiscal-${periodo.from}_a_${periodo.to}`,
    "pdf",
  );
  doc.save(filename);
}

function formatDateBr(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
