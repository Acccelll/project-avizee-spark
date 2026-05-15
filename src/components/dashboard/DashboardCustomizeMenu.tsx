import { useState } from 'react';
import { Eye, EyeOff, GripVertical, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WIDGET_REGISTRY, type WidgetMeta } from '@/lib/dashboard/widgets';
import type { DashboardLayoutPrefs, WidgetId } from '@/hooks/useDashboardLayout';

interface DashboardCustomizeMenuProps {
  prefs: DashboardLayoutPrefs;
  onToggle: (id: WidgetId) => void | Promise<void>;
  /** Reorder via drag-and-drop. Substitui os antigos botões ↑↓. */
  onReorder: (newOrder: WidgetId[]) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

function SortableWidgetItem({
  id,
  meta,
  hidden,
  onToggle,
}: {
  id: WidgetId;
  meta: WidgetMeta;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const pair = meta.pairWith ? WIDGET_REGISTRY[meta.pairWith] : null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-background px-3 py-2 touch-none"
    >
      <button
        type="button"
        className="flex h-7 w-5 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        aria-label={`Arrastar ${meta.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{meta.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{meta.description}</p>
        {pair && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/80">
            <span aria-hidden>⇄</span>
            <span>Par com: {pair.label}</span>
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onToggle}
        disabled={meta.required}
        aria-label={hidden ? `Mostrar ${meta.label}` : `Ocultar ${meta.label}`}
        title={meta.required ? 'Obrigatório' : hidden ? 'Mostrar' : 'Ocultar'}
      >
        {hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
      </Button>
    </li>
  );
}

export function DashboardCustomizeMenu({ prefs, onToggle, onReorder, onReset }: DashboardCustomizeMenuProps) {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = prefs.order.indexOf(active.id as WidgetId);
      const newIndex = prefs.order.indexOf(over.id as WidgetId);
      if (oldIndex < 0 || newIndex < 0) return;
      const newOrder = arrayMove(prefs.order, oldIndex, newIndex);
      void onReorder(newOrder);
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-label="Personalizar dashboard">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Personalizar</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Personalizar dashboard</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={() => setConfirmResetOpen(true)}
            >
              <RotateCcw className="h-3 w-3" />
              Restaurar
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={prefs.order} strategy={verticalListSortingStrategy}>
              <ul className="max-h-[60vh] divide-y divide-border/40 overflow-y-auto">
                {prefs.order.map((id) => {
                  const meta = WIDGET_REGISTRY[id];
                  if (!meta) return null;
                  const hidden = prefs.hidden.includes(id);
                  return (
                    <SortableWidgetItem
                      key={id}
                      id={id}
                      meta={meta}
                      hidden={hidden}
                      onToggle={() => void onToggle(id)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          void onReset();
          setConfirmResetOpen(false);
        }}
        title="Restaurar layout padrão?"
        description="Toda a personalização (ordem e widgets ocultos) será revertida para o padrão. Esta ação pode ser desfeita refazendo a personalização manualmente."
        confirmLabel="Restaurar"
        confirmVariant="default"
      />
    </>
  );
}
