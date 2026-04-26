import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listarSlideUsoAgregado } from '@/services/apresentacaoService';
import { APRESENTACAO_SLIDES_MAP } from '@/lib/apresentacao/slideDefinitions';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

export function ApresentacaoTelemetriaPanel() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['apresentacao-slide-uso'],
    queryFn: listarSlideUsoAgregado,
  });

  const sorted = [...data].sort((a, b) => b.total_gerado - a.total_gerado);
  const top = sorted.slice(0, 5);
  const bottom = sorted.filter((s) => s.total_gerado > 0).slice(-5).reverse();
  const totalGeracoes = data.reduce((acc, s) => acc + s.total_gerado, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Uso dos slides
          <Badge variant="outline" className="ml-auto text-[10px]">
            {totalGeracoes} eventos de geração
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando telemetria...</p>
        ) : data.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados de uso ainda. Gere apresentações para popular as estatísticas.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-600" /> Top 5 mais usados
              </p>
              <ul className="space-y-1">
                {top.map((s) => (
                  <li key={s.slide_codigo} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate">{APRESENTACAO_SLIDES_MAP.get(s.slide_codigo as never)?.titulo ?? s.slide_codigo}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-[10px]">{formatDate(s.ultimo_uso_em)}</span>
                      <Badge variant="secondary" className="text-[10px]">{s.total_gerado}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-rose-600" /> Menos usados
              </p>
              <ul className="space-y-1">
                {bottom.map((s) => (
                  <li key={s.slide_codigo} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate">{APRESENTACAO_SLIDES_MAP.get(s.slide_codigo as never)?.titulo ?? s.slide_codigo}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-[10px]">{formatDate(s.ultimo_uso_em)}</span>
                      <Badge variant="outline" className="text-[10px]">{s.total_gerado}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}