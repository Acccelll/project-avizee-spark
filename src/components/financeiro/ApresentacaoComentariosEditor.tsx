import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buscarComentarios, salvarComentario } from '@/services/apresentacaoService';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface Props {
  geracaoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApresentacaoComentariosEditor: React.FC<Props> = ({ geracaoId, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const { data: comentarios, isLoading } = useQuery({
    queryKey: ['apresentacao-comentarios', geracaoId],
    queryFn: () => buscarComentarios(geracaoId),
    enabled: open
  });

  const mutation = useMutation({
    mutationFn: salvarComentario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacao-comentarios', geracaoId] });
      toast.success('Comentários salvos!');
    }
  });

  const handleSave = async () => {
    // Na verdade o salvamento é individual no rascunho ou poderíamos fazer batch
    // Para simplificar V1, vamos fechar o dialog pois as edições são por campo (simulado aqui)
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar Comentários Executivos</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {comentarios?.map((c) => (
                <div key={c.id} className="space-y-2 border-b pb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-primary">{c.titulo || c.slide_codigo}</h4>
                    <span className="text-xs text-muted-foreground uppercase">{c.slide_codigo}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Sugestão Automática</Label>
                      <div className="p-2 bg-muted rounded text-xs italic">
                        {c.comentario_automatico}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-primary">Edição Executiva</Label>
                      <Textarea
                        defaultValue={c.comentario_editado || ''}
                        onBlur={(e) => {
                          if (e.target.value !== c.comentario_editado) {
                            mutation.mutate({ id: c.id, comentario_editado: e.target.value });
                          }
                        }}
                        className="text-xs h-20"
                        placeholder="Escreva um comentário personalizado..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)}>Concluir Revisão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
