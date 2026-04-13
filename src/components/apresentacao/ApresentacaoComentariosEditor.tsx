import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ApresentacaoComentario } from '@/types/apresentacao';

export function ApresentacaoComentariosEditor({
  comentarios,
  onChange,
}: {
  comentarios: ApresentacaoComentario[];
  onChange: (id: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {comentarios.map((c) => (
        <div key={c.id} className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">{c.titulo ?? c.slide_codigo}</p>
          <p className="text-xs text-muted-foreground">Status: {c.comentario_status} · prioridade: {c.prioridade}</p>
          <p className="text-xs text-muted-foreground">Auto: {c.comentario_automatico ?? '—'}</p>
          <Label>Comentário editado</Label>
          <Textarea
            value={c.comentario_editado ?? ''}
            onChange={(e) => onChange(c.id, e.target.value)}
            placeholder="Opcional. Se vazio, o comentário automático será usado."
          />
        </div>
      ))}
    </div>
  );
}
