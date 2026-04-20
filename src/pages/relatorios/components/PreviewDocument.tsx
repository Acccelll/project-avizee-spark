/**
 * PreviewDocument — layout "documento" para o PreviewModal de relatórios.
 *
 * Renderiza:
 *   - cabeçalho com nome/CNPJ da empresa e meta (período, data de geração)
 *   - KPIs em grid 4-col compacto
 *   - tabela com cabeçalho e alinhamento numérico
 *   - footer de totais idêntico ao da tela principal
 *
 * Toda a lógica de formatação reaproveita os mesmos helpers da tela principal
 * para garantir consistência visual entre tela / preview / PDF.
 */

import type { ReactNode } from "react";
import { ReportResultFooter, type FooterTotalCol } from "./ReportResultFooter";
import type { EmpresaConfigRef } from "../hooks/useRelatoriosFiltrosData";
import { formatCellValue } from "@/services/relatorios.service";

interface PreviewKpi {
  title: string;
  value: string;
}

interface PreviewColumn {
  key: string;
  label: string;
}

export interface PreviewDocumentProps {
  empresa?: EmpresaConfigRef;
  reportTitle: string;
  reportSubtitle?: string;
  periodLabel: string;
  generatedAt?: Date;
  generatedBy?: string;
  kpis?: PreviewKpi[];
  columns: PreviewColumn[];
  rows: Record<string, unknown>[];
  isQuantityReport?: boolean;
  footerCols?: FooterTotalCol[];
  /** Conteúdo customizado para relatórios não-tabulares (ex: DRE). */
  customBody?: ReactNode;
}

export function PreviewDocument({
  empresa,
  reportTitle,
  reportSubtitle,
  periodLabel,
  generatedAt = new Date(),
  generatedBy,
  kpis,
  columns,
  rows,
  isQuantityReport,
  footerCols,
  customBody,
}: PreviewDocumentProps) {
  const empresaNome =
    empresa?.nome_fantasia || empresa?.razao_social || "Empresa";
  const empresaDoc = empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : "";
  const dataGeracao = generatedAt.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Cabeçalho do documento */}
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-sm font-bold text-foreground">{empresaNome}</p>
          {empresaDoc && (
            <p className="text-xs text-muted-foreground">{empresaDoc}</p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          <p>
            Gerado em <span className="text-foreground">{dataGeracao}</span>
          </p>
          {generatedBy && (
            <p>
              Por <span className="text-foreground">{generatedBy}</span>
            </p>
          )}
        </div>
      </div>

      {/* Título do relatório */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{reportTitle}</h1>
        {reportSubtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{reportSubtitle}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">Pré-visualização documental. O layout final pode variar ligeiramente conforme o formato exportado.</p>
        <p className="text-xs text-muted-foreground mt-1.5">
          <span className="font-medium text-foreground">Período:</span> {periodLabel}
          <span className="mx-2 text-muted-foreground/50">·</span>
          <span className="font-medium text-foreground">{rows.length}</span>{" "}
          {rows.length === 1 ? "registro" : "registros"}
        </p>
      </div>

      {/* KPIs */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border rounded-md p-3 bg-muted/30">
          {kpis.map((kpi) => (
            <div key={kpi.title}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                {kpi.title}
              </p>
              <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Corpo: customizado (DRE) ou tabela padrão */}
      {customBody ? (
        customBody
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum dado disponível para o filtro atual.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground border-b uppercase tracking-wide"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-1.5 border-b border-border/40 text-xs tabular-nums"
                    >
                      {formatCellValue(row[col.key], col.key, isQuantityReport) as ReactNode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer de totais */}
      {footerCols && footerCols.length > 0 && (
        <ReportResultFooter rows={rows} cols={footerCols} />
      )}
    </div>
  );
}
