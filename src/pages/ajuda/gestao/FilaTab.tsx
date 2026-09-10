import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useFilaChamados } from "@/pages/ajuda/hooks/useSuporteAdmin";
import type { SuporteChamado, SuporteStatus, SuporteTipo } from "@/services/suporte.service";
import { STATUS_BADGE_CLASS, STATUS_BADGE_VARIANT, STATUS_LABELS, TIPO_LABELS } from "@/pages/ajuda/suporteLabels";
import { TriagemDialog } from "./TriagemDialog";

const PRIORIDADE_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

/** Fila em tabela — já vem ordenada por prioridade (crítica primeiro) e mais antigo primeiro dentro de cada prioridade. */
export function FilaTab() {
  const { data: chamados, isLoading } = useFilaChamados();
  const [filtroStatus, setFiltroStatus] = useState<SuporteStatus | "todos">("todos");
  const [filtroTipo, setFiltroTipo] = useState<SuporteTipo | "todos">("todos");
  const [selecionado, setSelecionado] = useState<SuporteChamado | null>(null);

  const filtrados = useMemo(() => {
    if (!chamados) return [];
    return chamados.filter((c) => {
      if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      return true;
    });
  }, [chamados, filtroStatus, filtroTipo]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as SuporteStatus | "todos")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.entries(STATUS_LABELS) as [SuporteStatus, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as SuporteTipo | "todos")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.entries(TIPO_LABELS) as [SuporteTipo, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : filtrados.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum chamado para os filtros selecionados.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Resumo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aberto em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((chamado) => (
                <TableRow key={chamado.id}>
                  <TableCell className="font-mono text-xs">{chamado.numero}</TableCell>
                  <TableCell className="max-w-xs truncate">{chamado.resumo}</TableCell>
                  <TableCell className="text-sm">{TIPO_LABELS[chamado.tipo]}</TableCell>
                  <TableCell className="text-sm">
                    {chamado.prioridade ? PRIORIDADE_LABELS[chamado.prioridade] : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_BADGE_VARIANT[chamado.status]}
                      className={cn(STATUS_BADGE_CLASS[chamado.status])}
                    >
                      {STATUS_LABELS[chamado.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(chamado.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelecionado(chamado)} aria-label="Triar">
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to={`/ajuda/chamados/${chamado.id}`} aria-label="Abrir chamado">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TriagemDialog chamado={selecionado} open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)} />
    </div>
  );
}
