import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorRow {
  linha: number;
  coluna?: string;
  mensagem: string;
  valor_original?: string;
}

interface ReconciliacaoErrosTableProps {
  erros: ErrorRow[];
  onExport?: () => void;
}

export function ReconciliacaoErrosTable({ erros, onExport }: ReconciliacaoErrosTableProps) {
  if (erros.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500" />
          Amostra de Inconsistências ({erros.length})
        </h4>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-muted/20">
        <Table>
          <TableHeader>
            <TableRow className="h-8 py-0">
              <TableHead className="w-[80px] h-8 text-[10px] uppercase">Linha</TableHead>
              <TableHead className="h-8 text-[10px] uppercase">Campo</TableHead>
              <TableHead className="h-8 text-[10px] uppercase">Mensagem de Erro</TableHead>
              <TableHead className="h-8 text-[10px] uppercase text-right">Valor Lido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {erros.slice(0, 10).map((err, i) => (
              <TableRow key={i} className="h-8 py-0">
                <TableCell className="font-mono text-[10px] h-8 py-1">{err.linha}</TableCell>
                <TableCell className="font-medium text-[10px] h-8 py-1">{err.coluna || "—"}</TableCell>
                <TableCell className="text-rose-600 text-[10px] h-8 py-1">{err.mensagem}</TableCell>
                <TableCell className="text-right font-mono text-[10px] h-8 py-1 truncate max-w-[150px]">
                  {err.valor_original || "—"}
                </TableCell>
              </TableRow>
            ))}
            {erros.length > 10 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[10px] text-muted-foreground italic h-8">
                  Exibindo 10 de {erros.length} erros. Use a exportação para ver a lista completa.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
