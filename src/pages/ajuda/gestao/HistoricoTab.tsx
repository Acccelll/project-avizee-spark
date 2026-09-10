import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useFilaChamados } from "@/pages/ajuda/hooks/useSuporteAdmin";
import type { SuporteStatus, SuporteTipo } from "@/services/suporte.service";
import {
  CAUSA_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  TIPO_LABELS,
} from "@/pages/ajuda/suporteLabels";

const STATUS_ENCERRADOS: SuporteStatus[] = ["resolvido", "fechado", "cancelado"];

/**
 * Histórico administrativo (spec §3.2/§36.1) — chamados que já chegaram a um
 * estado final (resolvido, fechado ou cancelado). Reaproveita a mesma
 * consulta da Fila (`useFilaChamados`, sem filtro de status no backend) e
 * filtra no cliente, evitando refazer a busca ao trocar de aba.
 */
export function HistoricoTab() {
  const { data: chamados, isLoading } = useFilaChamados();
  const [filtroStatus, setFiltroStatus] = useState<SuporteStatus | "todos">("todos");
  const [filtroTipo, setFiltroTipo] = useState<SuporteTipo | "todos">("todos");
  const [busca, setBusca] = useState("");

  const encerrados = useMemo(() => (chamados ?? []).filter((c) => STATUS_ENCERRADOS.includes(c.status)), [chamados]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return encerrados
      .filter((c) => {
        if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
        if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
        if (termo && !c.numero.toLowerCase().includes(termo) && !c.resumo.toLowerCase().includes(termo)) return false;
        return true;
      })
      .sort((a, b) => {
        const dataA = a.closed_at ?? a.resolved_at ?? a.created_at;
        const dataB = b.closed_at ?? b.resolved_at ?? b.created_at;
        return dataB.localeCompare(dataA);
      });
  }, [encerrados, filtroStatus, filtroTipo, busca]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por número ou texto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-64"
        />
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as SuporteStatus | "todos")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status encerrados</SelectItem>
            {STATUS_ENCERRADOS.map((status) => (
              <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
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
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum chamado encerrado para os filtros selecionados.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Resumo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Causa</TableHead>
                <TableHead>Aberto em</TableHead>
                <TableHead>Encerrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((chamado) => (
                <TableRow key={chamado.id}>
                  <TableCell className="font-mono text-xs">{chamado.numero}</TableCell>
                  <TableCell className="max-w-xs truncate">{chamado.resumo}</TableCell>
                  <TableCell className="text-sm">{TIPO_LABELS[chamado.tipo]}</TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_BADGE_VARIANT[chamado.status]}
                      className={cn(STATUS_BADGE_CLASS[chamado.status])}
                    >
                      {STATUS_LABELS[chamado.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {chamado.causa_resolucao ? CAUSA_LABELS[chamado.causa_resolucao] : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(chamado.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(chamado.closed_at ?? chamado.resolved_at ?? chamado.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link to={`/ajuda/chamados/${chamado.id}`} aria-label="Abrir chamado">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
