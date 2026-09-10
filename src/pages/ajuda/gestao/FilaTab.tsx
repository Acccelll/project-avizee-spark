import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIdade } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmins, useFilaChamados, useUsuarios } from "@/pages/ajuda/hooks/useSuporteAdmin";
import type { SuporteChamado, SuporteStatus, SuporteTipo } from "@/services/suporte.service";
import { STATUS_BADGE_CLASS, STATUS_BADGE_VARIANT, STATUS_LABELS, TIPO_LABELS } from "@/pages/ajuda/suporteLabels";
import { TriagemDialog } from "./TriagemDialog";

const PRIORIDADE_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

type FiltroRapido = "todos" | "novos" | "meus" | "criticos" | "sem_responsavel" | "aguardando" | "resolvidos";

const FILTROS_RAPIDOS: { value: FiltroRapido; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "novos", label: "Novos" },
  { value: "meus", label: "Meus" },
  { value: "criticos", label: "Críticos" },
  { value: "sem_responsavel", label: "Sem responsável" },
  { value: "aguardando", label: "Aguardando usuário" },
  { value: "resolvidos", label: "Resolvidos" },
];

type OrdenarPor = "prioridade" | "abertura" | "atualizacao" | "solicitante" | "modulo";

const ORDENAR_LABELS: Record<OrdenarPor, string> = {
  prioridade: "Prioridade (padrão)",
  abertura: "Abertura (mais antigo primeiro)",
  atualizacao: "Última atualização",
  solicitante: "Solicitante",
  modulo: "Módulo",
};

const PRIORIDADE_ORDEM: Record<string, number> = { critica: 0, alta: 1, normal: 2, baixa: 3 };

function correspondeAoFiltroRapido(chamado: SuporteChamado, filtro: FiltroRapido, meuId?: string): boolean {
  switch (filtro) {
    case "novos":
      return chamado.status === "aberto";
    case "meus":
      return !!meuId && chamado.responsavel_id === meuId;
    case "criticos":
      return chamado.prioridade === "critica";
    case "sem_responsavel":
      return !chamado.responsavel_id;
    case "aguardando":
      return chamado.status === "aguardando_usuario";
    case "resolvidos":
      return chamado.status === "resolvido";
    default:
      return true;
  }
}

/** Fila administrativa em tabela (spec §21) — tela operacional diária. */
export function FilaTab() {
  const { user } = useAuth();
  const { data: chamados, isLoading } = useFilaChamados();
  const { data: admins } = useAdmins();
  const { data: usuarios } = useUsuarios();

  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<SuporteStatus | "todos">("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<SuporteTipo | "todos">("todos");
  const [filtroModulo, setFiltroModulo] = useState<string>("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [filtroSolicitante, setFiltroSolicitante] = useState<string>("todos");
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>("prioridade");
  const [selecionado, setSelecionado] = useState<SuporteChamado | null>(null);

  const nomesPorId = useMemo(() => {
    const map = new Map<string, string>();
    (admins ?? []).forEach((a) => map.set(a.id, a.nome));
    (usuarios ?? []).forEach((u) => map.set(u.id, u.nome));
    return map;
  }, [admins, usuarios]);

  const modulos = useMemo(() => {
    const set = new Set<string>();
    (chamados ?? []).forEach((c) => c.modulo && set.add(c.modulo));
    return Array.from(set).sort();
  }, [chamados]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = (chamados ?? []).filter((c) => {
      if (!correspondeAoFiltroRapido(c, filtroRapido, user?.id)) return false;
      if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
      if (filtroPrioridade !== "todos" && c.prioridade !== filtroPrioridade) return false;
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (filtroModulo !== "todos" && c.modulo !== filtroModulo) return false;
      if (filtroResponsavel !== "todos" && c.responsavel_id !== filtroResponsavel) return false;
      if (filtroSolicitante !== "todos" && c.solicitante_id !== filtroSolicitante) return false;
      if (termo && !c.numero.toLowerCase().includes(termo) && !c.resumo.toLowerCase().includes(termo)) return false;
      return true;
    });

    const ordenados = [...lista];
    switch (ordenarPor) {
      case "abertura":
        ordenados.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "atualizacao":
        ordenados.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        break;
      case "solicitante":
        ordenados.sort((a, b) =>
          (nomesPorId.get(a.solicitante_id) ?? "").localeCompare(nomesPorId.get(b.solicitante_id) ?? ""),
        );
        break;
      case "modulo":
        ordenados.sort((a, b) => (a.modulo ?? "").localeCompare(b.modulo ?? ""));
        break;
      default:
        ordenados.sort((a, b) => {
          const pa = a.prioridade ? PRIORIDADE_ORDEM[a.prioridade] : 99;
          const pb = b.prioridade ? PRIORIDADE_ORDEM[b.prioridade] : 99;
          if (pa !== pb) return pa - pb;
          return a.created_at.localeCompare(b.created_at);
        });
    }
    return ordenados;
  }, [
    chamados,
    filtroRapido,
    filtroStatus,
    filtroPrioridade,
    filtroTipo,
    filtroModulo,
    filtroResponsavel,
    filtroSolicitante,
    busca,
    ordenarPor,
    nomesPorId,
    user?.id,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTROS_RAPIDOS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filtroRapido === f.value ? "default" : "outline"}
            onClick={() => setFiltroRapido(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por número ou texto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-64"
        />
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as SuporteStatus | "todos")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.entries(STATUS_LABELS) as [SuporteStatus, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda prioridade</SelectItem>
            {(Object.entries(PRIORIDADE_LABELS)).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as SuporteTipo | "todos")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.entries(TIPO_LABELS) as [SuporteTipo, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo módulo</SelectItem>
            {modulos.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo responsável</SelectItem>
            {(admins ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroSolicitante} onValueChange={setFiltroSolicitante}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo solicitante</SelectItem>
            {(usuarios ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordenarPor} onValueChange={(v) => setOrdenarPor(v as OrdenarPor)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(ORDENAR_LABELS) as [OrdenarPor, string][]).map(([value, label]) => (
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
                <TableHead>Módulo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Idade</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">{chamado.modulo ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {chamado.responsavel_id ? nomesPorId.get(chamado.responsavel_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatIdade(chamado.created_at)}</TableCell>
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
