import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertCircle, AlertTriangle, ArrowUpCircle, PlusCircle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PreviewImportacaoTableProps {
  data: any[];
  importType: string;
}

const actionConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  inserir: { label: "Novo", icon: <PlusCircle className="h-3 w-3" />, className: "bg-success/15 text-success border-success/30" },
  atualizar: { label: "Atualizar", icon: <ArrowUpCircle className="h-3 w-3" />, className: "bg-info/15 text-info border-info/30" },
  duplicado: { label: "Duplicado", icon: <Copy className="h-3 w-3" />, className: "bg-warning/15 text-warning border-warning/30" },
};

export function PreviewImportacaoTable({ data, importType }: PreviewImportacaoTableProps) {
  if (data.length === 0) return null;

  const stats = {
    total: data.length,
    validos: data.filter(r => r._valid).length,
    novos: data.filter(r => r._action === "inserir" && r._valid).length,
    atualizados: data.filter(r => r._action === "atualizar" && r._valid).length,
    erros: data.filter(r => !r._valid).length,
    warnings: data.filter(r => r._warnings?.length > 0).length,
  };

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge variant="outline" className="gap-1">{stats.total} total</Badge>
        <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
          <PlusCircle className="h-3 w-3" /> {stats.novos} novos
        </Badge>
        <Badge variant="outline" className="gap-1 bg-info/10 text-info border-info/30">
          <ArrowUpCircle className="h-3 w-3" /> {stats.atualizados} atualizações
        </Badge>
        {stats.erros > 0 && (
          <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3" /> {stats.erros} erros
          </Badge>
        )}
        {stats.warnings > 0 && (
          <Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/30">
            <AlertTriangle className="h-3 w-3" /> {stats.warnings} avisos
          </Badge>
        )}
      </div>

      <div className="rounded-md border bg-card max-h-[500px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50">
            <TableRow>
              <TableHead className="w-[70px]">Status</TableHead>
              <TableHead className="w-[70px]">Ação</TableHead>
              <TableHead className="w-[60px]">Linha</TableHead>
              <TableHead>Campo Principal</TableHead>
              <TableHead>Identificação</TableHead>
              <TableHead>Erros/Avisos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => {
              const action = actionConfig[row._action] || actionConfig.inserir;
              return (
                <TableRow key={i} className={cn(
                  !row._valid && "bg-destructive/5 hover:bg-destructive/10",
                  row._warnings?.length > 0 && row._valid && "bg-warning/5",
                  "transition-colors"
                )}>
                  <TableCell className="text-center">
                    {row._valid ? (
                      <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border", action.className)}>
                      {action.icon} {action.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{row._originalLine}</TableCell>
                  <TableCell className="font-medium text-sm truncate max-w-[200px]">
                    {row.nome || row.nome_razao_social || row.descricao || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {importType === "produtos"
                      ? (row.codigo_legado || row.codigo_interno || "-")
                      : (row.cpf_cnpj || row.codigo_legado || "-")}
                  </TableCell>
                  <TableCell>
                    {!row._valid && (
                      <div className="flex flex-col gap-0.5 text-[10px] text-destructive">
                        {row._errors?.map((err: string, j: number) => (
                          <div key={j} className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                          </div>
                        ))}
                      </div>
                    )}
                    {row._warnings?.length > 0 && (
                      <div className="flex flex-col gap-0.5 text-[10px] text-warning">
                        {row._warnings.map((w: string, j: number) => (
                          <div key={j} className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
                          </div>
                        ))}
                      </div>
                    )}
                    {row._valid && (!row._warnings || row._warnings.length === 0) && (
                      <span className="text-[10px] text-success">Pronto</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
