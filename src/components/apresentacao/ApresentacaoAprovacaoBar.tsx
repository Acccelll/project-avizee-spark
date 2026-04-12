import { CheckCircle2, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApresentacaoGeracao } from '@/types/apresentacao';

export function ApresentacaoAprovacaoBar({
  geracao,
  canAprovar,
  onEnviarRevisao,
  onAprovarGerar,
}: {
  geracao: ApresentacaoGeracao | null;
  canAprovar: boolean;
  onEnviarRevisao: () => Promise<void>;
  onAprovarGerar: () => Promise<void>;
}) {
  if (!geracao) return null;

  return (
    <div className="rounded-md border p-3 flex items-center justify-between gap-3 bg-muted/30">
      <div>
        <p className="text-sm font-medium">Fluxo editorial</p>
        <p className="text-xs text-muted-foreground">Status atual: {geracao.status_editorial ?? 'rascunho'}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEnviarRevisao}>
          <FileCheck2 className="h-4 w-4 mr-1" />Enviar para revisão
        </Button>
        {canAprovar && (
          <Button size="sm" onClick={onAprovarGerar}>
            <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar e gerar final
          </Button>
        )}
      </div>
    </div>
  );
}
