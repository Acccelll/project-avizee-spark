import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";

interface PreviewFinanceiroTableProps {
  data: any[];
}

export function PreviewFinanceiroTable({ data }: PreviewFinanceiroTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-md border bg-card max-h-[500px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50">
          <TableRow>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Pessoa</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Erros/Avisos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, i) => (
            <TableRow key={i} className={cn(!item._valid && "bg-rose-50/50")}>
              <TableCell className="text-center">
                {item._valid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-500 mx-auto" />
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                   {item.tipo === 'receber' ? (
                     <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                   ) : (
                     <ArrowUpRight className="h-3 w-3 text-rose-500" />
                   )}
                   <span className="text-xs uppercase font-medium">{item.tipo}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-[180px] truncate font-medium">{item.descricao}</TableCell>
              <TableCell className="text-xs">
                {item.data_vencimento ? format(parseISO(item.data_vencimento), "dd/MM/yyyy") : "—"}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {formatCurrency(item.valor)}
              </TableCell>
              <TableCell>
                {!item._valid && (
                  <div className="flex flex-col gap-1 text-[10px] text-rose-600">
                    {item._errors.map((err: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
                {item._valid && <span className="text-[10px] text-emerald-600 font-medium">Válido</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
