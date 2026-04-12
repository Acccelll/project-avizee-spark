import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { atualizarStatusEditorial } from '@/services/apresentacaoService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ApresentacaoGeracao } from '@/types/apresentacao';
import { CheckCircle, ShieldCheck, Forward } from 'lucide-react';

interface Props {
  geracao: ApresentacaoGeracao;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApresentacaoAprovacaoBar: React.FC<Props> = ({ geracao, open, onOpenChange }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ status }: { status: 'revisao' | 'aprovado' }) =>
      atualizarStatusEditorial(geracao.id, status, status === 'aprovado' ? user?.id : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
      toast.success('Status editorial atualizado!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fluxo de Governança</DialogTitle>
          <DialogDescription>
            Defina o estágio atual desta apresentação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto flex flex-col items-start p-4 gap-1"
            onClick={() => mutation.mutate({ status: 'revisao' })}
            disabled={mutation.isPending}
          >
            <div className="flex items-center gap-2 font-semibold">
              <Forward className="h-4 w-4 text-amber-500" />
              Enviar para Revisão
            </div>
            <div className="text-xs text-muted-foreground font-normal">
              Sinaliza que os dados iniciais foram carregados e aguarda revisão executiva.
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex flex-col items-start p-4 gap-1 border-green-200 hover:border-green-300 hover:bg-green-50"
            onClick={() => mutation.mutate({ status: 'aprovado' })}
            disabled={mutation.isPending}
          >
            <div className="flex items-center gap-2 font-semibold text-green-700">
              <CheckCircle className="h-4 w-4" />
              Aprovar Conteúdo
            </div>
            <div className="text-xs text-muted-foreground font-normal">
              Confirma que os comentários e dados estão corretos para a geração final.
            </div>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {geracao.status_editorial === 'aprovado' && (
            <div className="flex items-center text-[10px] text-muted-foreground gap-1 italic">
              <ShieldCheck className="h-3 w-3" />
              Aprovado por você
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
