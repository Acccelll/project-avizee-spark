import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nomeMes } from '@/lib/apresentacao/fechamento/formato';
import { pendenciasDoMes } from '@/lib/apresentacao/fechamento/pendencias';
import type { ApresentacaoFechamentoDados } from '@/lib/apresentacao/fechamento/tipos';

export function PendenciasFechamento({ dados, onInformar }: { dados: ApresentacaoFechamentoDados; onInformar?: () => void }) {
  const itens = pendenciasDoMes(dados);
  const faltam = itens.filter((i) => !i.ok).length;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Dados de {nomeMes(dados.competencia)}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {itens.map((i) => (
          <li key={i.texto} className="flex items-start gap-2">
            {i.ok
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="ok" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="pendente" />}
            <span>{i.texto}</span>
          </li>
        ))}
      </ul>
      {faltam > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          O aviso não bloqueia o download.
          {onInformar && (
            <>
              {' '}
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onInformar}>Informar no Workbook</Button>
            </>
          )}
        </p>
      )}
    </section>
  );
}
