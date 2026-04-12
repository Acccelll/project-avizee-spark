import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ApresentacaoComentario } from '@/types/apresentacao';

interface ApresentacaoComentariosEditorProps {
  comentarios: ApresentacaoComentario[];
  onSave: (comentarioId: string, comentarioEditado: string) => Promise<void>;
  isSaving: boolean;
}

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
        .sort((a, b) => a.ordem - b.ordem)
        .map((c) => {
          const isEditing = editingId === c.id;
          const hasEditedVersion = Boolean(c.comentario_editado?.trim());
          const displayText = c.comentario_editado ?? c.comentario_automatico ?? '';

          return (
            <div key={c.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {c.titulo ?? c.slide_codigo}
                  </span>
                  {hasEditedVersion && (
                    <Badge variant="outline" className="text-[10px]">
                      Editado
                    </Badge>
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
