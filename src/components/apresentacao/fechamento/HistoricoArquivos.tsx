import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mesAnoCurto } from '@/lib/apresentacao/fechamento/formato';

export interface ItemHistorico {
  id: string;
  /** AAAA-MM */
  competencia: string | null;
  /** ISO da geração ou aprovação. */
  data: string;
  extensao: 'pptx' | 'xlsx';
  etiquetas: Array<{ texto: string; destaque?: boolean }>;
  detalhe?: string;
  onDownload?: () => void;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Arquivos já gerados do fechamento: apresentações finais e Workbooks. */
export function HistoricoArquivos({ itens }: { itens: ItemHistorico[] }) {
  if (!itens.length) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Versões anteriores</h3>
      <ul className="mt-3 divide-y text-sm">
        {itens.map((r) => (
          <li key={`${r.extensao}-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.competencia ? mesAnoCurto(r.competencia) : '—'}</span>
              {r.etiquetas.map((e) => (
                <Badge key={e.texto} variant={e.destaque ? 'secondary' : 'outline'}>{e.texto}</Badge>
              ))}
              <span className="text-muted-foreground">{dataCurta(r.data)}</span>
              {r.detalhe ? <span className="text-muted-foreground">· {r.detalhe}</span> : null}
            </div>
            {r.onDownload && (
              <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-0 sm:h-8" onClick={r.onDownload}>
                <Download className="mr-1 h-4 w-4" />
                .{r.extensao}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
