import { useState } from 'react';
import { Check, Pencil, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ApresentacaoComentario } from '@/types/apresentacao';

interface ApresentacaoComentariosEditorProps {
  comentarios: ApresentacaoComentario[];
  onSave: (comentarioId: string, comentarioEditado: string) => Promise<void>;
  isSaving: boolean;
}

const PRIORIDADE_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'Normal', color: '' },
  2: { label: 'Elevada', color: 'text-blue-600' },
  3: { label: 'Alta', color: 'text-amber-600' },
  4: { label: 'Urgente', color: 'text-orange-600' },
  5: { label: 'Crítico', color: 'text-red-600' },
};

export function ApresentacaoComentariosEditor({
  comentarios,
  onSave,
  isSaving,
}: ApresentacaoComentariosEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const startEdit = (comentario: ApresentacaoComentario) => {
    setEditingId(comentario.id);
    setEditText(
      comentario.comentario_editado ??
        comentario.comentario_automatico ??
        ''
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (comentarioId: string) => {
    await onSave(comentarioId, editText);
    setEditingId(null);
    setEditText('');
  };

  if (comentarios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum comentário disponível. Gere uma apresentação primeiro.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {comentarios
        .sort((a, b) => {
          // Sort by priority desc, then by ordem asc
          const prioDiff = (b.prioridade ?? 1) - (a.prioridade ?? 1);
          return prioDiff !== 0 ? prioDiff : a.ordem - b.ordem;
        })
        .map((c) => {
          const isEditing = editingId === c.id;
          const hasEditedVersion = Boolean(c.comentario_editado?.trim());
          const displayText = c.comentario_editado ?? c.comentario_automatico ?? '';
          const prio = c.prioridade ?? 1;
          const prioCfg = PRIORIDADE_CONFIG[prio] ?? PRIORIDADE_CONFIG[1];
          const isHighPriority = prio >= 3;

          return (
            <div
              key={c.id}
              className={`rounded-lg border bg-card p-3 ${isHighPriority ? 'border-amber-300' : 'border-border'}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {c.titulo ?? c.slide_codigo}
                  </span>
                  {hasEditedVersion && (
                    <Badge variant="outline" className="text-[10px]">
                      Editado
                    </Badge>
                  )}
                  {c.comentario_status === 'aprovado' && (
                    <Badge variant="default" className="text-[10px]">
                      Aprovado
                    </Badge>
                  )}
                  {isHighPriority && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${prioCfg.color}`}>
                      <AlertCircle className="h-3 w-3" />
                      {prioCfg.label}
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => startEdit(c)}
                    aria-label={`Editar comentário do slide ${c.titulo ?? c.slide_codigo}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="text-sm"
                    aria-label="Editar comentário executivo"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      aria-label="Cancelar edição"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(c.id)}
                      disabled={isSaving}
                      aria-label="Salvar comentário editado"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {displayText || (
                    <span className="italic text-muted-foreground">Sem comentário.</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
    </div>
  );
}
