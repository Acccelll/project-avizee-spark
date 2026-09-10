import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { calculateDaysBetween } from "@/lib/format";
import { useFilaChamados, useMoverStatusChamado } from "@/pages/ajuda/hooks/useSuporteAdmin";
import type { SuporteChamado, SuporteStatus } from "@/services/suporte.service";
import { STATUS_LABELS, TIPO_ICON_EMOJI } from "@/pages/ajuda/suporteLabels";
import { TriagemDialog } from "./TriagemDialog";
import { agruparPorColuna, decidirAcaoDrag, KANBAN_COLUNAS } from "./kanbanLogic";

function KanbanCard({ chamado, onTriar }: { chamado: SuporteChamado; onTriar: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chamado.id,
    data: { status: chamado.status },
  });

  const dias = calculateDaysBetween(chamado.created_at, new Date());

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onTriar}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "cursor-grab space-y-1.5 p-2.5 text-xs active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg",
        chamado.prioridade === "critica" && "border-destructive/50",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-muted-foreground">{chamado.numero}</span>
        <span aria-hidden>{TIPO_ICON_EMOJI[chamado.tipo]}</span>
      </div>
      <p className="line-clamp-2 font-medium leading-snug">{chamado.resumo}</p>
      <div className="flex items-center justify-between text-muted-foreground">
        {chamado.prioridade ? (
          <Badge variant={chamado.prioridade === "critica" ? "destructive" : "outline"} className="text-[10px]">
            {chamado.prioridade}
          </Badge>
        ) : <span />}
        <span>{dias === 0 ? "hoje" : `${dias}d`}</span>
      </div>
    </Card>
  );
}

function KanbanColumn({ status, chamados, onTriar }: {
  status: SuporteStatus;
  chamados: SuporteChamado[];
  onTriar: (c: SuporteChamado) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2.5",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs font-semibold">{STATUS_LABELS[status]}</p>
        <Badge variant="secondary" className="text-[10px]">{chamados.length}</Badge>
      </div>
      <div className="flex flex-col gap-2 min-h-[60px]">
        {chamados.map((c) => (
          <KanbanCard key={c.id} chamado={c} onTriar={() => onTriar(c)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Quadro Kanban — arrastar um card para outra coluna dispara
 * `suporte_triar_chamado(status=...)`, exceto para "Resolvido", que abre a
 * triagem com a seção de resolução já expandida (a tabela exige resumo).
 */
export function KanbanTab() {
  const { data: chamados, isLoading } = useFilaChamados();
  const mover = useMoverStatusChamado();
  const [selecionado, setSelecionado] = useState<SuporteChamado | null>(null);
  const [autoAbrirResolucao, setAutoAbrirResolucao] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const porColuna = useMemo(() => agruparPorColuna(chamados ?? []), [chamados]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const chamadoId = String(active.id);
    const statusOrigem = active.data.current?.status as SuporteStatus | undefined;
    const statusDestino = String(over.id) as SuporteStatus;
    if (!statusOrigem) return;

    const acao = decidirAcaoDrag(statusOrigem, statusDestino);
    if (acao === "nenhuma") return;

    if (acao === "abrir_resolucao") {
      const chamado = (chamados ?? []).find((c) => c.id === chamadoId);
      if (chamado) {
        setAutoAbrirResolucao(true);
        setSelecionado(chamado);
      }
      return;
    }
    mover.mutate({ chamadoId, status: statusDestino });
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUNAS.map((s) => <Skeleton key={s} className="h-96 w-64 shrink-0 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLUNAS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              chamados={porColuna[status] ?? []}
              onTriar={(c) => {
                setAutoAbrirResolucao(false);
                setSelecionado(c);
              }}
            />
          ))}
        </div>
      </DndContext>

      <TriagemDialog
        chamado={selecionado}
        open={!!selecionado}
        onOpenChange={(open) => !open && setSelecionado(null)}
        autoAbrirResolucao={autoAbrirResolucao}
      />
    </div>
  );
}
