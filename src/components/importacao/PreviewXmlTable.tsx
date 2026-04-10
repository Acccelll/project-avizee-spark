import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertCircle, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { XmlImportItem } from "@/hooks/importacao/useImportacaoXml";
import { formatCurrency } from "@/lib/format";

interface PreviewXmlTableProps {
  data: XmlImportItem[];
}

export function PreviewXmlTable({ data }: PreviewXmlTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-md border bg-card max-h-[500px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50">
          <TableRow>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead>Nota / Série</TableHead>
            <TableHead>Emitente</TableHead>
            <TableHead>Valor Total</TableHead>
            <TableHead>Mensagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, i) => (
            <TableRow key={i} className={cn(item.status === "erro" && "bg-rose-50/50", item.status === "duplicado" && "bg-amber-50/50")}>
              <TableCell className="text-center">
                {item.status === "valido" && <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />}
                {item.status === "erro" && <XCircle className="h-5 w-5 text-rose-500 mx-auto" />}
                {item.status === "duplicado" && <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />}
                {item.status === "pendente" && <FileCode className="h-5 w-5 text-muted-foreground mx-auto animate-pulse" />}
              </TableCell>
              <TableCell className="max-w-[150px] truncate text-xs font-mono">{item.fileName}</TableCell>
              <TableCell>
                {item.data ? (
                  <div className="text-xs">
                    <span className="font-bold">{item.data.numero}</span>
                    <span className="text-muted-foreground ml-1">ser: {item.data.serie}</span>
                  </div>
                ) : "—"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs">
                {item.data?.emitente.razaoSocial || "—"}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {item.data ? formatCurrency(item.data.valorTotal) : "—"}
              </TableCell>
              <TableCell>
                <span className={cn(
                  "text-[10px] font-medium",
                  item.status === "erro" ? "text-rose-600" :
                  item.status === "duplicado" ? "text-amber-600" : "text-emerald-600"
                )}>
                  {item.error || "NF-e válida para importação"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
