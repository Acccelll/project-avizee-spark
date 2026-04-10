import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupedNF } from "@/hooks/importacao/useImportacaoFaturamento";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";

interface PreviewFaturamentoTableProps {
  data: GroupedNF[];
}

export function PreviewFaturamentoTable({ data }: PreviewFaturamentoTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-md border bg-card max-h-[500px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50">
          <TableRow>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead>Número NF</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Emissão</TableHead>
            <TableHead className="text-center">Itens</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Erros/Avisos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((nf, i) => (
            <TableRow key={i} className={cn(nf.status === "erro" && "bg-rose-50/50")}>
              <TableCell className="text-center">
                {nf.status === "valido" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-500 mx-auto" />
                )}
              </TableCell>
              <TableCell className="font-bold">{nf.numero}</TableCell>
              <TableCell className="max-w-[200px] truncate">{nf.cliente_nome}</TableCell>
              <TableCell className="text-xs">
                {nf.data_emissao ? format(parseISO(nf.data_emissao), "dd/MM/yyyy") : "—"}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  {nf.itens_count}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {formatCurrency(nf.valor_total)}
              </TableCell>
              <TableCell>
                {nf.status === "erro" && (
                  <div className="flex flex-col gap-1 text-[10px] text-rose-600">
                    {Array.from(new Set(nf.errors)).map((err, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
                {nf.status === "valido" && <span className="text-[10px] text-emerald-600 font-medium">Validada</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
