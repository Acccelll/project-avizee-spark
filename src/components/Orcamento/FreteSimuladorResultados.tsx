/**
 * Subcomponente: lista de opções de frete com ação de selecionar/remover.
 */
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { FreteOpcaoLocal } from '@/services/freteSimulacao.service';

function fonteBadge(fonte: FreteOpcaoLocal['fonte']) {
  if (fonte === 'correios') return <Badge variant="secondary">Correios</Badge>;
  if (fonte === 'cliente_vinculada') return <Badge variant="outline">Transportadora</Badge>;
  return <Badge>Manual</Badge>;
}

export interface FreteOpcoesListProps {
  opcoes: FreteOpcaoLocal[];
  opcaoSelecionadaId: string | null;
  onSelect: (opcao: FreteOpcaoLocal) => void;
  onRemove: (opcao: FreteOpcaoLocal) => void;
  showFonte?: boolean;
}

export function FreteOpcoesList({ opcoes, opcaoSelecionadaId, onSelect, onRemove, showFonte }: FreteOpcoesListProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opcoes.map((opcao) => {
        const selecionada = opcao.id === opcaoSelecionadaId;
        return (
          <div
            key={opcao.id}
            className={`relative flex items-start justify-between rounded-lg border p-3 transition-colors ${
              selecionada ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-accent/40'
            }`}
          >
            <button className="flex-1 text-left" onClick={() => onSelect(opcao)} type="button">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{opcao.servico || 'Frete'}</p>
                {showFonte && fonteBadge(opcao.fonte)}
                {opcao.transportadora_nome && (
                  <span className="text-xs text-muted-foreground">{opcao.transportadora_nome}</span>
                )}
              </div>
              {opcao.modalidade && <p className="text-xs text-muted-foreground">{opcao.modalidade}</p>}
              <p className="text-xs text-muted-foreground">
                {opcao.prazo_dias != null ? `${opcao.prazo_dias} dias` : 'Prazo não informado'}
              </p>
              <p className="text-sm font-bold mt-1">{formatCurrency(opcao.valor_total)}</p>
              {opcao.observacoes && <p className="text-xs text-muted-foreground mt-0.5 italic">{opcao.observacoes}</p>}
            </button>
            <div className="flex flex-col items-end gap-1 ml-2">
              {selecionada && <CheckCircle2 className="h-4 w-4 text-primary" />}
              {!selecionada && opcao.id && (
                <button type="button" onClick={() => onRemove(opcao)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remover opção">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
