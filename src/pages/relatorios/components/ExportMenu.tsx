/**
 * ExportMenu — dropdown unificado [Exportar ▾] para PDF / Excel / CSV.
 *
 * Substitui os 3 botões soltos (PDF, Excel, CSV) por uma CTA única com menu,
 * mostrando o escopo do export ("47 registros · 8 colunas") como hint.
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, FileDown, ChevronDown } from "lucide-react";

export interface ExportMenuProps {
  recordCount: number;
  columnCount: number;
  disabled?: boolean;
  loading?: boolean;
  pdfRowLimitHint?: number;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
}

export function ExportMenu({
  recordCount,
  columnCount,
  disabled,
  loading,
  pdfRowLimitHint,
  onExportPdf,
  onExportExcel,
  onExportCsv,
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={disabled || loading}
          className="gap-1.5"
          aria-label="Exportar relatório"
        >
          <Download className="h-3.5 w-3.5" />
          {loading ? "Exportando..." : "Exportar"}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 font-normal text-xs text-muted-foreground">
          <span>Formato de exportação</span>
          <span className="font-medium text-foreground">
            {recordCount} reg · {columnCount} col
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-success" />
          <div className="flex-1">
            <div className="text-sm font-medium">Excel (.xlsx)</div>
            <div className="text-xs text-muted-foreground">Planilha com formatação</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPdf} className="gap-2">
          <FileText className="h-4 w-4 text-destructive" />
          <div className="flex-1">
            <div className="text-sm font-medium">PDF</div>
            <div className="text-xs text-muted-foreground">Documento para impressão{pdfRowLimitHint ? ` (até ${pdfRowLimitHint} linhas recomendadas)` : ''}</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCsv} className="gap-2">
          <FileDown className="h-4 w-4 text-info" />
          <div className="flex-1">
            <div className="text-sm font-medium">CSV</div>
            <div className="text-xs text-muted-foreground">Texto separado por vírgula</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
