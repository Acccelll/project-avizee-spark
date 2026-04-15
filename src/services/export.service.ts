/**
 * Centralised export service for the Reports module.
 *
 * Provides three export formats:
 *   - CSV  (synchronous, plain text)
 *   - Excel (.xlsx via exceljs)
 *   - PDF   (jsPDF, landscape A4, dynamic column widths)
 *
 * All public functions accept the same `ExportPayload` so callers do not need
 * to know the underlying library.
 */

import { downloadTextFile } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { RelatorioResultado } from "@/services/relatorios.service";

export interface EmpresaInfo {
  razao_social?: string;
  cnpj?: string;
  nome_fantasia?: string;
}

export interface ExportOptions {
  /** Report title used as the file name */
  titulo: string;
  /** Rows to export. Each object is one row; keys are column names. */
  rows: Record<string, unknown>[];
  /** Optional empresa info for the PDF header */
  empresa?: EmpresaInfo | null;
  /** Date range label for PDF header */
  dataInicio?: string;
  dataFim?: string;
  /** Full report result (used for PDF subtitle) */
  resultado?: RelatorioResultado;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Exports `rows` as a semicolon-delimited CSV file and triggers a browser
 * download.
 */
export function exportarParaCsv(options: ExportOptions): void {
  const { titulo, rows } = options;

  if (!rows.length) {
    downloadTextFile(`${titulo}.csv`, "Sem dados para exportação");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((h) => formatCsvCell(row[h])).join(";")
    ),
  ].join("\n");

  downloadTextFile(`${titulo}.csv`, csv, "text/csv;charset=utf-8");
}

function formatCsvCell(value: unknown): string {
  if (typeof value === "number") return value.toString().replace(".", ",");
  if (value == null) return "";
  return `"${String(value).split('"').join('""')}"`;
}

// ─── Excel ───────────────────────────────────────────────────────────────────

/**
 * Exports `rows` as an .xlsx file using exceljs.
 */
export async function exportarParaExcel(options: ExportOptions): Promise<void> {
  const { titulo, rows } = options;
  if (!rows.length) return;

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(titulo.slice(0, 31));

  const headers = Object.keys(rows[0]);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8E8" },
  };

  rows.forEach((row) => {
    sheet.addRow(headers.map((h) => row[h] ?? ""));
  });

  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      maxLen = Math.max(maxLen, String(cell.value ?? "").length + 2);
    });
    col.width = Math.min(maxLen, 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${titulo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/** Maximum rows included in a PDF export (file-size / render time constraint). */
export const PDF_MAX_ROWS = 200;

/**
 * Builds a jsPDF document from the report result and triggers a browser
 * download.
 */
export async function exportarParaPdf(options: ExportOptions): Promise<void> {
  const { titulo, rows, empresa, dataInicio = "", dataFim = "", resultado } = options;

  const doc = await buildPdfDocument({
    titulo: resultado?.title ?? titulo,
    subtitulo: resultado?.subtitle ?? "",
    rows,
    empresa: empresa ?? null,
    dataInicio,
    dataFim,
  });

  doc.save(`${resultado?.title ?? titulo}.pdf`);
}

interface PdfBuildParams {
  titulo: string;
  subtitulo: string;
  rows: Record<string, unknown>[];
  empresa: EmpresaInfo | null;
  dataInicio: string;
  dataFim: string;
}

/** Returns a configured jsPDF document (landscape A4). */
export async function buildPdfDocument(params: PdfBuildParams) {
  const { titulo, subtitulo, rows, empresa, dataInicio, dataFim } = params;
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Company header
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

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(titulo || "Relatório", margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitulo || "", margin, y);
  y += 4;
  const periodoText =
    dataInicio || dataFim
      ? `Período: ${dataInicio || "—"} a ${dataFim || "—"}`
      : `Gerado em: ${new Date().toLocaleDateString("pt-BR")}`;
  doc.text(periodoText, margin, y);
  y += 8;

  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    const contentWidth = pageWidth - margin * 2;

    // Dynamic column widths
    const maxCharsPerCol = keys.map((key) => {
      const headerLabel = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase());
      let maxLen = headerLabel.length;
      const sample = rows.slice(0, 50);
      for (const row of sample) {
        const val = String(formatCellValuePdf(row[key], key) ?? "");
        if (val.length > maxLen) maxLen = val.length;
      }
      return Math.min(maxLen, 35);
    });
    const totalChars = maxCharsPerCol.reduce((s, c) => s + c, 0) || 1;
    const colWidths = maxCharsPerCol.map((c) =>
      Math.max((c / totalChars) * contentWidth, 12)
    );

    // Header row
    doc.setFillColor(105, 5, 0);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    let xPos = margin;
    keys.forEach((key, i) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase());
      doc.text(label.substring(0, 25), xPos + 1.5, y + 5, {
        maxWidth: colWidths[i] - 2,
      });
      xPos += colWidths[i];
    });
    y += 7;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    const maxRows = Math.min(rows.length, PDF_MAX_ROWS);
    if (rows.length > PDF_MAX_ROWS) {
      y += 10;
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bolditalic");
      doc.setTextColor(180, 0, 0);
      doc.text(
        `⚠ PDF limitado a ${PDF_MAX_ROWS} de ${rows.length} registros. Use "Exportar Excel" para o relatório completo.`,
        margin,
        y
      );
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
    }

    for (let r = 0; r < maxRows; r++) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 15;
      }
      if (r % 2 === 0) {
        doc.setFillColor(245, 245, 240);
        doc.rect(margin, y, contentWidth, 6, "F");
      }
      xPos = margin;
      keys.forEach((key, i) => {
        const val = String(formatCellValuePdf(rows[r][key], key) ?? "");
        doc.text(val.substring(0, 35), xPos + 1.5, y + 4, {
          maxWidth: colWidths[i] - 2,
        });
        xPos += colWidths[i];
      });
      y += 6;
    }

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Total de registros: ${rows.length}`, margin, y);
  }

  return doc;
}

/** Formats a cell value for PDF rendering (mirrors formatCellValue from the service). */
function formatCellValuePdf(value: unknown, key: string): string | number {
  if (typeof value === "number") {
    if (
      ["valor", "custo", "venda", "entrada", "saida"].some((f) =>
        key.toLowerCase().includes(f)
      )
    ) {
      return formatCurrency(value);
    }
    return formatNumber(value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }
  return (value ?? "-") as string;
}
