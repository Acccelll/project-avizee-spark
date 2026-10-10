import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NOME_VERSAO } from '@/lib/apresentacao/fechamento/base';
import { mesAnoCurto } from '@/lib/apresentacao/fechamento/formato';
import type { VersaoApresentacaoRow } from '@/services/apresentacaoFechamentoService';

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function HistoricoVersoes({ itens, canDownload, onDownload }: { itens: VersaoApresentacaoRow[]; canDownload: boolean; onDownload: (r: VersaoApresentacaoRow) => void }) {
  if (!itens.length) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Versões anteriores</h3>
      <ul className="mt-3 divide-y text-sm">
        {itens.map((r) => {
          const comp = r.competencia ?? r.competencia_inicial?.slice(0, 7) ?? null;
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{comp ? mesAnoCurto(comp) : '—'}</span>
                {r.versao ? <Badge variant="secondary">{NOME_VERSAO[r.versao]}</Badge> : <Badge variant="outline">Modelo antigo</Badge>}
                {r.is_final && r.versao && <Badge variant="outline">Final</Badge>}
                <span className="text-muted-foreground">{dataCurta(r.aprovado_em ?? r.updated_at ?? r.created_at)}</span>
                {r.total_slides ? <span className="text-muted-foreground">· {r.total_slides} slides</span> : null}
              </div>
              {canDownload && r.arquivo_path && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => onDownload(r)}>
                  <Download className="mr-1 h-4 w-4" />
                  .pptx
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
