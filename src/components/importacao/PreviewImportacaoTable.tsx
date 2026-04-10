import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewImportacaoTableProps {
  data: any[];
  importType: string;
}

export function PreviewImportacaoTable({ data, importType }: PreviewImportacaoTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-md border bg-card max-h-[500px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50">
          <TableRow>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[80px]">Linha</TableHead>
            <TableHead>Campo Principal</TableHead>
            <TableHead>Identificação</TableHead>
            <TableHead>Erros/Avisos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i} className={cn(!row._valid && "bg-rose-50/50 hover:bg-rose-50 transition-colors")}>
              <TableCell className="text-center">
                {row._valid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-500 mx-auto" />
                )}
              </TableCell>
              <TableCell className="text-center font-mono text-xs">{row._originalLine}</TableCell>
              <TableCell className="font-medium">{row.nome}</TableCell>
              <TableCell className="font-mono text-xs">
                {importType === "produtos" ? row.codigo_interno : row.cpf_cnpj}
              </TableCell>
              <TableCell>
                {!row._valid && (
                  <div className="flex flex-col gap-1 text-[11px] text-rose-600">
                    {row._errors.map((err: string, i: number) => (
                      <div key={i} className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
                {row._valid && <span className="text-[11px] text-emerald-600">Pronto para importar</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
