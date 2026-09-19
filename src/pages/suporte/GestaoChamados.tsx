import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RequireStrictAdmin } from '@/components/admin/RequireStrictAdmin';
import { useFilaChamados } from '@/hooks/suporte/useFilaChamados';
import { notifyError } from '@/utils/errorMessages';
import { INVALIDATION_KEYS } from '@/services/_invalidationKeys';
import * as chamadosSvc from '@/services/suporte/chamados.service';
import {
  SUPORTE_STATUS_LABELS,
  SUPORTE_TIPO_LABELS,
  SUPORTE_PRIORIDADE_LABELS,
} from '@/services/suporte/types';
import type { SuporteChamado, SuporteStatus } from '@/services/suporte/types';

type Aba = 'visao_geral' | 'fila' | 'kanban' | 'historico';

const ABERTOS: SuporteStatus[] = ['aberto', 'em_triagem', 'em_andamento', 'aguardando_usuario'];
const FECHADOS: SuporteStatus[] = ['resolvido', 'fechado', 'cancelado'];
const KANBAN_COLUNAS: SuporteStatus[] = [
  'aberto',
  'em_triagem',
  'em_andamento',
  'aguardando_usuario',
  'resolvido',
  'fechado',
];

function idadeEmDias(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

const PRIORIDADE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  critica: 'destructive',
  alta: 'default',
  normal: 'secondary',
  baixa: 'outline',
};

/** Contagens ao vivo (Parte IV, item 7) — sem tabela de agregação, direto sobre a fila carregada. */
function VisaoGeral({ chamados }: { chamados: SuporteChamado[] }) {
  const seteDiasAtras = Date.now() - 7 * 86_400_000;
  const tiles = [
    { label: 'Abertos', valor: chamados.filter((c) => ABERTOS.includes(c.status)).length },
    { label: 'Em andamento', valor: chamados.filter((c) => c.status === 'em_andamento').length },
    {
      label: 'Aguardando usuário',
      valor: chamados.filter((c) => c.status === 'aguardando_usuario').length,
    },
    {
      label: 'Críticos sem responsável',
      valor: chamados.filter((c) => c.prioridade === 'critica' && !c.responsavel_id).length,
    },
    {
      label: 'Resolvidos (7 dias)',
      valor: chamados.filter(
        (c) => c.resolved_at && new Date(c.resolved_at).getTime() >= seteDiasAtras,
      ).length,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{t.valor}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type FiltroFila = 'todos' | 'novos' | 'criticos' | 'sem_responsavel' | 'aguardando_usuario';

function Fila({ chamados }: { chamados: SuporteChamado[] }) {
  const [filtro, setFiltro] = useState<FiltroFila>('todos');

  const filtrados = useMemo(() => {
    const abertos = chamados.filter((c) => !FECHADOS.includes(c.status));
    switch (filtro) {
      case 'novos':
        return abertos.filter((c) => c.status === 'aberto');
      case 'criticos':
        return abertos.filter((c) => c.prioridade === 'critica');
      case 'sem_responsavel':
        return abertos.filter((c) => !c.responsavel_id);
      case 'aguardando_usuario':
        return abertos.filter((c) => c.status === 'aguardando_usuario');
      default:
        return abertos;
    }
  }, [chamados, filtro]);

  return (
    <div className="space-y-3">
      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroFila)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="novos">Novos</TabsTrigger>
          <TabsTrigger value="criticos">Críticos</TabsTrigger>
          <TabsTrigger value="sem_responsavel">Sem responsável</TabsTrigger>
          <TabsTrigger value="aguardando_usuario">Aguardando usuário</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Idade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum chamado nesta categoria.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-xs">
                    <Link to={`/ajuda/meus-chamados/${c.id}`} className="hover:underline">
                      {c.numero}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">{c.resumo}</TableCell>
                  <TableCell>{SUPORTE_TIPO_LABELS[c.tipo]}</TableCell>
                  <TableCell>
                    {c.prioridade ? (
                      <Badge variant={PRIORIDADE_BADGE_VARIANT[c.prioridade]}>
                        {SUPORTE_PRIORIDADE_LABELS[c.prioridade]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{SUPORTE_STATUS_LABELS[c.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.modulo ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{idadeEmDias(c.created_at)}d</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Card de chamado usado no Kanban — arrastável via HTML5 DnD nativo (sem lib extra). */
function KanbanCard({ chamado, onDragStart }: { chamado: SuporteChamado; onDragStart: (id: string) => void }) {
  return (
    <Link
      to={`/ajuda/meus-chamados/${chamado.id}`}
      draggable
      onDragStart={() => onDragStart(chamado.id)}
      className="block rounded-md border bg-card p-2.5 text-xs shadow-sm hover:shadow transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span className="font-mono text-muted-foreground">{chamado.numero}</span>
        {chamado.prioridade && (
          <Badge variant={PRIORIDADE_BADGE_VARIANT[chamado.prioridade]} className="text-[10px] px-1.5 py-0">
            {SUPORTE_PRIORIDADE_LABELS[chamado.prioridade]}
          </Badge>
        )}
      </div>
      <p className="line-clamp-2 font-medium">{chamado.resumo}</p>
    </Link>
  );
}

/**
 * Kanban (seção 27): drag-and-drop altera o status de fato, via a mesma RPC
 * de triagem usada na Fila — nunca uma reordenação puramente visual.
 */
function Kanban({ chamados, onDropNoStatus }: { chamados: SuporteChamado[]; onDropNoStatus: (id: string, status: SuporteStatus) => void }) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);

  const porColuna = useMemo(() => {
    const map = new Map<SuporteStatus, SuporteChamado[]>();
    KANBAN_COLUNAS.forEach((s) => map.set(s, []));
    chamados.forEach((c) => {
      if (map.has(c.status)) map.get(c.status)!.push(c);
    });
    return map;
  }, [chamados]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUNAS.map((status) => (
        <div
          key={status}
          className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted/30 p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (arrastandoId) onDropNoStatus(arrastandoId, status);
            setArrastandoId(null);
          }}
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold">{SUPORTE_STATUS_LABELS[status]}</h3>
            <span className="text-[10px] text-muted-foreground">{porColuna.get(status)?.length ?? 0}</span>
          </div>
          <div className="flex flex-col gap-2 min-h-[60px]">
            {(porColuna.get(status) ?? []).map((c) => (
              <KanbanCard key={c.id} chamado={c} onDragStart={setArrastandoId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Historico({ chamados }: { chamados: SuporteChamado[] }) {
  const resolvidos = useMemo(
    () => chamados.filter((c) => FECHADOS.includes(c.status)),
    [chamados],
  );

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chamado</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Causa</TableHead>
            <TableHead>Resolvido em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resolvidos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                Nenhum chamado no histórico ainda.
              </TableCell>
            </TableRow>
          ) : (
            resolvidos.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">
                  <Link to={`/ajuda/meus-chamados/${c.id}`} className="hover:underline">
                    {c.numero}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[320px] truncate">{c.resumo}</TableCell>
                <TableCell>
                  <Badge variant="outline">{SUPORTE_STATUS_LABELS[c.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.causa_resolucao ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.resolved_at ? new Date(c.resolved_at).toLocaleDateString('pt-BR') : '—'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * "Gestão de chamados" — área administrativa da especificação de Ajuda/Suporte
 * (Parte I, item 2 e itens 18/19/27). Restrita a admin estrito (III.14).
 */
function GestaoChamadosConteudo() {
  const { chamados, loading } = useFilaChamados();
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>('visao_geral');

  const triarStatus = useMutation({
    mutationFn: ({ chamadoId, status }: { chamadoId: string; status: SuporteStatus }) =>
      chamadosSvc.triarChamado(chamadoId, { status }),
    onSuccess: async () => {
      await Promise.all(INVALIDATION_KEYS.suporte.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success('Status atualizado.');
    },
    onError: (e) => notifyError(e),
  });

  const handleDropNoStatus = (chamadoId: string, status: SuporteStatus) => {
    triarStatus.mutate({ chamadoId, status });
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Gestão de chamados</h1>
        <p className="text-sm text-muted-foreground">
          Visão administrativa de todos os chamados de suporte do ERP.
        </p>
      </header>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList>
          <TabsTrigger value="visao_geral">Visão geral</TabsTrigger>
          <TabsTrigger value="fila">Fila</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {aba === 'visao_geral' && <VisaoGeral chamados={chamados} />}
          {aba === 'fila' && <Fila chamados={chamados} />}
          {aba === 'kanban' && (
            <Kanban chamados={chamados} onDropNoStatus={handleDropNoStatus} />
          )}
          {aba === 'historico' && <Historico chamados={chamados} />}
        </>
      )}
    </div>
  );
}

export default function GestaoChamados() {
  return (
    <RequireStrictAdmin resourceLabel="Gestão de chamados">
      <GestaoChamadosConteudo />
    </RequireStrictAdmin>
  );
}
